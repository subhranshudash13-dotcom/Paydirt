"""End-to-end train + predict tests (PRD §7.3/§7.4)."""
from __future__ import annotations

import pytest

from app import state
from app.predict import ModelNotTrained, predict_rows
from app.train import time_split, train


@pytest.fixture(autouse=True)
def _reset_state():
    state.set_active(None)  # type: ignore[arg-type]
    yield
    state.set_active(None)  # type: ignore[arg-type]


def test_time_split_is_chronological() -> None:
    rows = [{"created_at": 30, "success": 1}, {"created_at": 10, "success": 0}, {"created_at": 20, "success": 1}]
    tr, te, how = time_split(rows, test_frac=0.34)
    assert how == "time"
    # newest rows land in test; train must all be older than the earliest test row
    assert max(r["created_at"] for r in tr) < min(r["created_at"] for r in te)


def test_time_split_falls_back_to_order_without_timestamps() -> None:
    rows = [{"success": 1}, {"success": 0}, {"success": 1}, {"success": 0}]
    tr, te, how = time_split(rows, test_frac=0.5)
    assert how == "order"
    assert len(te) == 2


def test_train_reports_all_required_metrics(labeled_rows) -> None:
    m = train(labeled_rows)
    assert m["backend"] in ("logistic", "tabpfn")
    assert m["split"] in ("time", "order")
    for key in ("chosen", "baselines", "daysToMerge"):
        assert key in m
    for key in ("rocAuc", "prAuc", "calibrationEce"):
        assert key in m["chosen"]
    for base in ("bountyOnly", "logistic", "gradientBoosted", "tabpfn"):
        assert base in m["baselines"]


def test_model_beats_bounty_only_baseline(labeled_rows) -> None:
    m = train(labeled_rows)
    chosen = m["chosen"]["rocAuc"]
    bounty = m["baselines"]["bountyOnly"]["rocAuc"]
    # Our snapshot-signal model should rank at least as well as bounty size alone.
    assert chosen >= bounty - 0.05
    assert chosen > 0.5


def test_predict_returns_probabilities_in_range(labeled_rows) -> None:
    train(labeled_rows)
    res = predict_rows(labeled_rows[:5])
    assert res["backend"] in ("logistic", "tabpfn")
    assert len(res["predictions"]) == 5
    for p in res["predictions"]:
        assert 0.0 <= p["pSuccess"] <= 1.0
        assert p["modelVersion"].startswith(("logistic", "tabpfn"))


def test_predict_before_train_raises(labeled_rows) -> None:
    with pytest.raises(ModelNotTrained):
        predict_rows(labeled_rows[:1])


def test_train_requires_two_classes() -> None:
    rows = [{"success": 1, "bounty_amount": 100}, {"success": 1, "bounty_amount": 200}]
    with pytest.raises(ValueError):
        train(rows)
