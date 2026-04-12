"""Shared fixtures for math-ai tests."""

from __future__ import annotations

from collections.abc import Generator
from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client() -> Generator[TestClient, Any, Any]:
    """TestClient with the sentence-transformers model mocked out."""
    mock_model = MagicMock()
    mock_model.encode.side_effect = lambda texts, **_: np.random.default_rng(0).random(
        (len(texts), 768)
    ).astype(np.float32)

    with patch("app.routers.similarity._get_model", return_value=mock_model):
        from app.main import app

        yield TestClient(app)
