"""Model + metric tests (pure-stdlib fallback + honest metrics)."""
from __future__ import annotations

from app.model import calibration_error, pr_auc, roc_auc, train_logistic, train_ridge


def test_logistic_learns_a_separable_boundary() -> None:
    # label 1 when x0 is high, 0 when low -> weights should learn positive x0.
    X = [[0.1], [0.2], [0.15], [0.05], [0.9], [0.95], [0.85], [0.8]]
    y = [0, 0, 0, 0, 1, 1, 1, 1]
    model = train_logistic(X, y)
    assert model.predict_proba([0.95]) > model.predict_proba([0.1])
    assert model.weights[0] > 0


def test_roc_auc_perfect_and_random() -> None:
    y = [0, 0, 1, 1]
    assert roc_auc(y, [0.1, 0.2, 0.8, 0.9]) == 1.0
    # degenerate single-class -> 0.5 by definition
    assert roc_auc([1, 1], [0.3, 0.7]) == 0.5


def test_pr_auc_higher_for_better_ranking() -> None:
    y = [0, 0, 0, 1, 1]
    good = pr_auc(y, [0.1, 0.2, 0.3, 0.9, 0.95])
    bad = pr_auc(y, [0.9, 0.8, 0.7, 0.1, 0.05])
    assert good > bad
    assert 0.0 <= good <= 1.0


def test_calibration_error_small_when_probs_match_frequency() -> None:
    # 10 rows, half positive; predicted 0.5 everywhere -> ECE ~ |0.5-0.5| small.
    y = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    probs = [0.5] * 10
    assert calibration_error(y, probs) < 0.05
    # wildly overconfident probs should score worse than well-calibrated ones
    overconf = [0.95 if t else 0.05 for t in y]
    assert calibration_error(y, [0.9] * 10) > calibration_error(y, [0.5] * 10)
    assert 0.0 <= calibration_error(y, overconf) <= 1.0


def test_ridge_fits_linear_target() -> None:
    X = [[0.0], [1.0], [2.0], [3.0]]
    y = [1.0, 3.0, 5.0, 7.0]  # y = 1 + 2x
    model = train_ridge(X, y)
    assert abs(model.predict([2.0]) - 5.0) < 1.0
