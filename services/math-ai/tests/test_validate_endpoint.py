"""POST /convert/latex-to-sympy endpoint smoke tests."""

from __future__ import annotations

from fastapi.testclient import TestClient


class TestLatexToSympyEndpoint:
    def test_valid_latex_returns_200(self, client: TestClient) -> None:
        resp = client.post(
            "/convert/latex-to-sympy",
            json={"latex": "x^2 + 1"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["sympy_expr"] is not None
        assert data["latex_normalized"] is not None

    def test_empty_latex_returns_error(self, client: TestClient) -> None:
        resp = client.post(
            "/convert/latex-to-sympy",
            json={"latex": "   "},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None

    def test_missing_field_returns_422(self, client: TestClient) -> None:
        resp = client.post("/convert/latex-to-sympy", json={})
        assert resp.status_code == 422

    def test_invalid_latex_returns_parse_error(self, client: TestClient) -> None:
        resp = client.post(
            "/convert/latex-to-sympy",
            json={"latex": "\\frac{}{}{}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None
