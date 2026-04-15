"""POST /generate and POST /generate/verify endpoint smoke tests."""

from __future__ import annotations

from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# POST /generate - 변이 문항 생성
# ---------------------------------------------------------------------------


class TestGenerateEndpoint:
    def test_valid_request_returns_200(self, client: TestClient) -> None:
        resp = client.post(
            "/generate",
            json={
                "body_template": "{{a}}x + {{b}} = {{c}}",
                "parameters": [
                    {"name": "a", "type": "integer", "min": 1, "max": 5, "constraints": ["nonzero"]},
                    {"name": "b", "type": "integer", "min": -5, "max": 5, "constraints": []},
                    {"name": "c", "type": "integer", "min": -10, "max": 10, "constraints": []},
                ],
                "answer_template": "({{c}} - {{b}}) / {{a}}",
                "constraints": {"integer_solution": True, "no_zero_denominator": True},
                "count": 2,
                "seed": 42,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert isinstance(data["variants"], list)
        assert len(data["variants"]) > 0
        variant = data["variants"][0]
        assert "body_latex" in variant
        assert "params" in variant
        assert "answer_value" in variant
        assert "answer_latex" in variant
        assert "seed" in variant

    def test_empty_body_template_returns_error(self, client: TestClient) -> None:
        resp = client.post(
            "/generate",
            json={
                "body_template": "   ",
                "parameters": [
                    {"name": "a", "type": "integer", "min": 1, "max": 5},
                ],
                "answer_template": "a",
                "count": 1,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None

    def test_missing_required_field_returns_422(self, client: TestClient) -> None:
        resp = client.post("/generate", json={})
        assert resp.status_code == 422

    def test_empty_parameters_returns_error(self, client: TestClient) -> None:
        resp = client.post(
            "/generate",
            json={
                "body_template": "{{a}}x = 1",
                "parameters": [],
                "answer_template": "1/{{a}}",
                "count": 1,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False


# ---------------------------------------------------------------------------
# POST /generate/verify - CAS 정답 검증
# ---------------------------------------------------------------------------


class TestVerifyEndpoint:
    def test_valid_verify_returns_200(self, client: TestClient) -> None:
        resp = client.post(
            "/generate/verify",
            json={
                "equation_latex": "x + 1 = 3",
                "answer_latex": "2",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["verification"] is not None
        assert "answer_correct" in data["verification"]

    def test_empty_equation_returns_error(self, client: TestClient) -> None:
        resp = client.post(
            "/generate/verify",
            json={
                "equation_latex": "",
                "answer_latex": "2",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None

    def test_missing_fields_returns_422(self, client: TestClient) -> None:
        resp = client.post("/generate/verify", json={})
        assert resp.status_code == 422
