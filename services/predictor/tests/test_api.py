"""HTTP surface tests (PRD §7.4): /health, /train, /predict."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import state
from app.main import app


@pytest.fixture(autouse=True)
def _reset_state():
    state.set_active(None)  # type: ignore[arg-type]
    yield
    state.set_active(None)  # type: ignore[arg-type]


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_health_before_train(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["modelTrained"] is False
    assert body["backend"] == "logistic"


def test_predict_before_train_is_409(client: TestClient, labeled_rows) -> None:
    r = client.post("/predict", json={"rows": labeled_rows[:2]})
    assert r.status_code == 409


def test_train_then_predict(client: TestClient, labeled_rows) -> None:
    tr = client.post("/train", json={"rows": labeled_rows})
    assert tr.status_code == 200
    metrics = tr.json()
    assert "chosen" in metrics and "baselines" in metrics

    hc = client.get("/health").json()
    assert hc["modelTrained"] is True
    assert hc["modelVersion"].startswith(("logistic", "tabpfn"))

    pr = client.post("/predict", json={"rows": labeled_rows[:3]})
    assert pr.status_code == 200
    preds = pr.json()["predictions"]
    assert len(preds) == 3
    assert all(0.0 <= p["pSuccess"] <= 1.0 for p in preds)


def test_train_rejects_empty(client: TestClient) -> None:
    assert client.post("/train", json={"rows": []}).status_code == 400


def test_train_rejects_degenerate_labels(client: TestClient) -> None:
    rows = [{"success": 0, "bounty_amount": 5}, {"success": 0, "bounty_amount": 10}]
    assert client.post("/train", json={"rows": rows}).status_code == 422
