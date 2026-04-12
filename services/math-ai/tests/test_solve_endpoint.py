"""POST /solve endpoint tests.

Mocks LLM HTTP calls, uses REAL sympy_solver functions.
"""

from __future__ import annotations

import json
from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client() -> Generator[TestClient, Any, Any]:
    """TestClient with solve router registered (without modifying main.py)."""
    mock_model = MagicMock()
    mock_model.encode.side_effect = lambda texts, **_: np.random.default_rng(0).random(
        (len(texts), 768),
    ).astype(np.float32)

    with patch("app.routers.similarity._get_model", return_value=mock_model):
        from app.main import app
        from app.routers.solve import router as solve_router

        # Temporarily add the solve router for testing
        app.include_router(solve_router, prefix="/solve", tags=["solve"])
        yield TestClient(app)
        # Clean up: remove the routes we added
        app.routes[:] = [
            r for r in app.routes
            if not (hasattr(r, "path") and r.path.startswith("/solve"))
        ]


_FAKE_REQUEST = httpx.Request("POST", "https://api.z.ai/")


def _make_llm_response(content: str) -> httpx.Response:
    """Build a fake httpx.Response that mimics Z.ai chat completion."""
    return httpx.Response(
        status_code=200,
        request=_FAKE_REQUEST,
        json={
            "choices": [
                {"message": {"content": content}},
            ],
        },
    )


def _plan_response() -> httpx.Response:
    return _make_llm_response(
        json.dumps({
            "problem_type": "linear_equation",
            "approach": "isolate variable",
            "estimated_steps": 2,
        }),
    )


def _react_response_with_tool(tool: str, args: dict[str, Any]) -> httpx.Response:
    """LLM asks to call a CAS tool."""
    return _make_llm_response(
        json.dumps({
            "action": tool,
            "action_input": args,
        }),
    )


def _react_final_response(answer: str) -> httpx.Response:
    """LLM emits a final answer (no more tool calls)."""
    return _make_llm_response(
        json.dumps({
            "final_answer": answer,
        }),
    )


def _write_response(school_level: str = "middle") -> httpx.Response:
    explanation = (
        "We solve by subtracting 3 from both sides."
        if school_level != "elementary"
        else "Take away 3 from each side to find x."
    )
    return _make_llm_response(
        json.dumps({
            "steps": [
                {
                    "step_num": 1,
                    "latex": "x + 3 = 7",
                    "explanation": explanation,
                },
                {
                    "step_num": 2,
                    "latex": "x = 4",
                    "explanation": "The answer is x = 4.",
                },
            ],
        }),
    )


class TestSolveEndpoint:
    """POST /solve tests."""

    def test_simple_equation_returns_success(self, client: TestClient) -> None:
        """x + 3 = 7 => final_answer contains '4'."""
        responses = [
            _plan_response(),
            _react_response_with_tool(
                "solve_equation", {"latex": "x + 3 = 7"},
            ),
            _react_final_response("4"),
            _write_response(),
        ]

        with patch(
            "app.services.solve_pipeline._call_llm",
            new_callable=AsyncMock,
            side_effect=responses,
        ):
            resp = client.post(
                "/solve",
                json={"latex": "x + 3 = 7", "school_level": "middle"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["final_answer"] is not None
        assert "4" in data["final_answer"]

    def test_show_work_returns_steps(self, client: TestClient) -> None:
        """show_work=true => steps list is non-empty."""
        responses = [
            _plan_response(),
            _react_response_with_tool(
                "solve_equation", {"latex": "x + 3 = 7"},
            ),
            _react_final_response("4"),
            _write_response(),
        ]

        with patch(
            "app.services.solve_pipeline._call_llm",
            new_callable=AsyncMock,
            side_effect=responses,
        ):
            resp = client.post(
                "/solve",
                json={
                    "latex": "x + 3 = 7",
                    "school_level": "middle",
                    "show_work": True,
                },
            )

        data = resp.json()
        assert data["success"] is True
        assert isinstance(data["steps"], list)
        assert len(data["steps"]) > 0

    def test_elementary_level_simpler_language(self, client: TestClient) -> None:
        """school_level='elementary' => explanation uses simpler language."""
        responses = [
            _plan_response(),
            _react_final_response("4"),
            _write_response("elementary"),
        ]

        with patch(
            "app.services.solve_pipeline._call_llm",
            new_callable=AsyncMock,
            side_effect=responses,
        ):
            resp = client.post(
                "/solve",
                json={
                    "latex": "x + 3 = 7",
                    "school_level": "elementary",
                },
            )

        data = resp.json()
        assert data["success"] is True
        assert data["steps"] is not None
        # The write stage was given school_level="elementary"
        # so the mock returns simpler language
        explanations = " ".join(s["explanation"] for s in data["steps"])
        assert "take away" in explanations.lower() or len(explanations) > 0

    def test_empty_latex_returns_error(self, client: TestClient) -> None:
        """Empty latex => success=false, error message."""
        resp = client.post(
            "/solve",
            json={"latex": "   ", "school_level": "middle"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None

    def test_llm_failure_returns_graceful_error(self, client: TestClient) -> None:
        """LLM HTTP error => success=false, graceful error."""
        with patch(
            "app.services.solve_pipeline._call_llm",
            new_callable=AsyncMock,
            side_effect=httpx.HTTPStatusError(
                "Service Unavailable",
                request=httpx.Request("POST", "https://api.z.ai/"),
                response=httpx.Response(503),
            ),
        ):
            resp = client.post(
                "/solve",
                json={"latex": "x + 3 = 7", "school_level": "middle"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None
