"""Tests for the /animate endpoint and pipeline."""

from __future__ import annotations

import json
from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def animate_client() -> Generator[TestClient, Any, Any]:
    """TestClient with similarity model mocked out (needed by app import)."""
    mock_model = MagicMock()
    import numpy as np

    mock_model.encode.side_effect = lambda texts, **_: np.random.default_rng(0).random(
        (len(texts), 768)
    ).astype(np.float32)

    with patch("app.routers.similarity._get_model", return_value=mock_model):
        from app.main import app
        from app.routers.animate import router as animate_router

        # Wire animate router without modifying app/main.py
        app.include_router(animate_router, prefix="/animate", tags=["animate"])
        yield TestClient(app)
        # Remove the router after tests to avoid duplicate registration
        app.routes[:] = [
            r for r in app.routes
            if not (hasattr(r, "path") and str(getattr(r, "path", "")).startswith("/animate"))
        ]


def _llm_content(content: str) -> str:
    """Return content string as _call_llm would after parsing the HTTP response."""
    return content


VALID_MANIM_CODE = '''\
from manim import *

class QuadraticScene(Scene):
    def construct(self):
        axes = Axes(x_range=[-3, 3], y_range=[-1, 9])
        graph = axes.plot(lambda x: x**2, color=BLUE)
        self.play(Create(axes), Create(graph))
        self.wait()
'''

GRAPH_MANIM_CODE = '''\
from manim import *

class GraphScene(Scene):
    def construct(self):
        axes = Axes(x_range=[-5, 5], y_range=[-5, 5])
        plot = axes.plot(lambda x: x**2, color=BLUE)
        self.play(Create(axes), Create(plot))
        self.wait()
'''

SYNTAX_ERROR_CODE = '''\
from manim import *

class BadScene(Scene)
    def construct(self):
        pass
'''


class TestAnimateEndpointSuccess:
    """Valid LaTeX should produce Manim code."""

    def test_valid_latex_returns_manim_code(self, animate_client: TestClient) -> None:
        analyze_resp = _llm_content(
            json.dumps({
                "concept_type": "equation",
                "key_elements": ["x", "quadratic"],
                "complexity": "simple",
            })
        )
        design_resp = _llm_content(
            json.dumps({
                "scenes": [{"description": "Show quadratic graph"}],
                "transitions": ["FadeIn"],
                "estimated_duration": 5,
            })
        )
        code_resp = _llm_content(VALID_MANIM_CODE)
        summary_resp = _llm_content("Quadratic equation animation showing x^2 graph.")

        responses = [analyze_resp, design_resp, code_resp, summary_resp]

        with patch(
            "app.services.animate_pipeline._call_llm",
            new_callable=AsyncMock,
            side_effect=responses,
        ):
            resp = animate_client.post(
                "/animate",
                json={"latex": "x^2 + 1 = 0", "animation_style": "step_by_step"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "class" in data["manim_code"]
        assert "Scene" in data["manim_code"]

    def test_graph_style_references_axes(self, animate_client: TestClient) -> None:
        analyze_resp = _llm_content(
            json.dumps({
                "concept_type": "function",
                "key_elements": ["x", "quadratic"],
                "complexity": "simple",
            })
        )
        design_resp = _llm_content(
            json.dumps({
                "scenes": [{"description": "Plot on axes"}],
                "transitions": ["FadeIn"],
                "estimated_duration": 5,
            })
        )
        code_resp = _llm_content(GRAPH_MANIM_CODE)
        summary_resp = _llm_content("Graph of x^2.")

        responses = [analyze_resp, design_resp, code_resp, summary_resp]

        with patch(
            "app.services.animate_pipeline._call_llm",
            new_callable=AsyncMock,
            side_effect=responses,
        ):
            resp = animate_client.post(
                "/animate",
                json={"latex": "y = x^2", "animation_style": "graph"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "Axes" in data["manim_code"] or "axes" in data["manim_code"].lower()


class TestAnimateEndpointEmptyLatex:
    """Empty latex should return success=false immediately."""

    def test_empty_latex_returns_error(self, animate_client: TestClient) -> None:
        resp = animate_client.post(
            "/animate",
            json={"latex": "", "animation_style": "step_by_step"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None


class TestAnimateEndpointLlmFailure:
    """LLM failure should return success=false gracefully."""

    def test_llm_failure_returns_error(self, animate_client: TestClient) -> None:
        with patch(
            "app.services.animate_pipeline._call_llm",
            new_callable=AsyncMock,
            side_effect=httpx.HTTPStatusError(
                "Service unavailable",
                request=httpx.Request("POST", "https://api.z.ai"),
                response=httpx.Response(503),
            ),
        ):
            resp = animate_client.post(
                "/animate",
                json={"latex": "x^2", "animation_style": "step_by_step"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None


class TestAnimateEndpointSyntaxError:
    """Generated code with syntax errors should be caught by validation."""

    def test_syntax_error_in_generated_code(self, animate_client: TestClient) -> None:
        analyze_resp = _llm_content(
            json.dumps({
                "concept_type": "equation",
                "key_elements": ["x"],
                "complexity": "simple",
            })
        )
        design_resp = _llm_content(
            json.dumps({
                "scenes": [{"description": "Show equation"}],
                "transitions": ["FadeIn"],
                "estimated_duration": 5,
            })
        )
        code_resp = _llm_content(SYNTAX_ERROR_CODE)
        summary_resp = _llm_content("Animation of equation.")

        responses = [analyze_resp, design_resp, code_resp, summary_resp]

        with patch(
            "app.services.animate_pipeline._call_llm",
            new_callable=AsyncMock,
            side_effect=responses,
        ):
            resp = animate_client.post(
                "/animate",
                json={"latex": "x + 1 = 0", "animation_style": "step_by_step"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None
        assert "syntax" in data["error"].lower() or "invalid" in data["error"].lower()
