"""POST /visualize endpoint tests."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fixture: TestClient with visualize router wired in
# ---------------------------------------------------------------------------


@pytest.fixture()
def viz_client() -> TestClient:
    """TestClient with LLM calls mocked out."""
    from fastapi import FastAPI

    from app.routers.visualize import router

    test_app = FastAPI()
    test_app.include_router(router, prefix="/visualize")
    return TestClient(test_app)


# ---------------------------------------------------------------------------
# Helpers: mock LLM responses per pipeline stage
# ---------------------------------------------------------------------------

_MOCK_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>'

_MOCK_CHARTJS = json.dumps(
    {
        "type": "line",
        "data": {"labels": ["0", "1", "2"], "datasets": [{"data": [0, 1, 4]}]},
    }
)


def _make_chat_response(content: str) -> dict[str, Any]:
    """Build a minimal OpenAI-compatible chat completion response."""
    return {
        "choices": [{"message": {"content": content}}],
    }


def _build_mock_post(viz_type: str = "svg") -> AsyncMock:
    """Return an AsyncMock whose .post() yields stage-appropriate responses."""
    content = _MOCK_SVG if viz_type == "svg" else _MOCK_CHARTJS

    # httpx.Response methods (json, raise_for_status) are sync — use MagicMock
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = _make_chat_response(content)
    mock_response.raise_for_status.return_value = None

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = False
    return mock_client


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------


class TestVisualizeEndpoint:
    """Tests for POST /visualize."""

    def test_valid_latex_svg(self, viz_client: TestClient) -> None:
        """Valid LaTeX with svg type returns success with SVG content."""
        mock_client = _build_mock_post("svg")

        with patch(
            "app.services.visualize_pipeline.httpx.AsyncClient",
            return_value=mock_client,
        ):
            resp = viz_client.post(
                "/visualize",
                json={"latex": "x^2 + 1", "visualization_type": "svg"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["visualization_type"] == "svg"
        assert "<svg" in data["content"]

    def test_valid_latex_chartjs(self, viz_client: TestClient) -> None:
        """Valid LaTeX with chartjs type returns success with JSON content."""
        mock_client = _build_mock_post("chartjs")

        with patch(
            "app.services.visualize_pipeline.httpx.AsyncClient",
            return_value=mock_client,
        ):
            resp = viz_client.post(
                "/visualize",
                json={"latex": "y = 2x + 3", "visualization_type": "chartjs"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["visualization_type"] == "chartjs"
        # Content should be parseable JSON
        parsed = json.loads(data["content"])
        assert "type" in parsed

    def test_empty_latex_returns_error(self, viz_client: TestClient) -> None:
        """Empty latex string returns success=false with error."""
        resp = viz_client.post(
            "/visualize",
            json={"latex": "   ", "visualization_type": "svg"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None
        assert data["content"] is None

    def test_llm_failure_returns_graceful_error(
        self, viz_client: TestClient
    ) -> None:
        """LLM service failure returns success=false with error message."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = Exception("LLM service error")

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = False

        with patch(
            "app.services.visualize_pipeline.httpx.AsyncClient",
            return_value=mock_client,
        ):
            resp = viz_client.post(
                "/visualize",
                json={"latex": "x^2", "visualization_type": "svg"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None
