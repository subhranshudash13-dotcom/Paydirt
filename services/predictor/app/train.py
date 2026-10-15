"""Train + honest evaluation (PRD §7.3).

Time-based split (train on older, test on newer; never random, never leaky). We
try TabPFN first; if unavailable we use the pure-Python logistic model so the
sidecar is always trainable/servable. We always report the baselines the PRD
demands — bounty-size-only, logistic regression, and gradient-boosted trees
(GBT only when scikit-learn is installed) — and pick the winner honestly.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from . import state, tabpfn
from .features import FeatureEncoder, _get
from .model import (
    LogisticModel,
    RidgeModel,
    calibration_error,
    pr_auc,
    roc_auc,
    train_logistic,
    train_ridge,
)

TEST_FRAC = 0.25
_MINUTES_LABEL_KEYS = ("success", "merged", "label")
_TIME_KEYS = (
    "snapshot_at",
    "snapshotAt",
    "snapshot_time",
    "created_at",
    "createdAt",
)


def _label(row: dict[str, Any]) -> int:
    for k in _MINUTES_LABEL_KEYS:
        if k in row and row[k] is not None:
            v = row[k]
            return 1 if (v is True or (isinstance(v, str) and v.lower() in ("1", "true", "yes"))) else int(bool(v))
    return 0


def _row_time(row: dict[str, Any]) -> Optional[float]:
    for k in _TIME_KEYS:
        v = row.get(k)
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str) and v:
            try:
                return datetime.fromisoformat(v.replace("Z", "+00:00")).timestamp()
            except ValueError:
                pass
    return None


def time_split(
    rows: list[dict[str, Any]], test_frac: float = TEST_FRAC
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str]:
    """Return (train, test, how). `how` is 'time' when a real timestamp existed,
    otherwise 'order' (rows assumed pre-sorted chronologically)."""
    timed = [(r, _row_time(r)) for r in rows]
    if any(t is None for _, t in timed):
        n = len(rows)
        cut = max(1, int(n * (1 - test_frac))) if n > 1 else n
        return rows[:cut], rows[cut:], "order"
    timed.sort(key=lambda rt: rt[1])  # type: ignore[arg-type]
    ordered = [r for r, _ in timed]
    cut = max(1, int(len(ordered) * (1 - test_frac))) if len(ordered) > 1 else len(ordered)
    return ordered[:cut], ordered[cut:], "time"


def _ranking_metrics(y_true: list[int], scores: list[float]) -> dict[str, float]:
    """Ranking-only metrics — valid for any monotonic score, including the raw
    bounty-dollar baseline which is NOT a probability and so has no calibration."""
    return {
        "rocAuc": round(roc_auc(y_true, scores), 4),
        "prAuc": round(pr_auc(y_true, scores), 4),
    }


def _clf_metrics(y_true: list[int], probs: list[float]) -> dict[str, float]:
    """Ranking metrics + calibration for probability-producing models only."""
    return {**_ranking_metrics(y_true, probs), "calibrationEce": round(calibration_error(y_true, probs), 4)}


def _train_gbt_baseline(
    Xtr: list[list[float]], ytr: list[int], Xte: list[list[float]], yte: list[int]
) -> Optional[dict[str, float]]:
    """Gradient-boosted trees baseline (optional). Skipped with a note when
    scikit-learn isn't installed so the core sidecar stays dependency-light."""
    try:
        from sklearn.ensemble import GradientBoostingClassifier  # type: ignore
    except Exception:
        return None
    gbt = GradientBoostingClassifier(n_estimators=60, max_depth=3, random_state=0)
    gbt.fit(Xtr, ytr)
    probs = [float(p[1]) for p in gbt.predict_proba(Xte)]
    return _clf_metrics(yte, probs)


def train(rows: list[dict[str, Any]]) -> dict[str, Any]:
    if len(rows) < 2:
        raise ValueError("need at least 2 labeled rows to train")

    ytr_full = [_label(r) for r in rows]
    if len(set(ytr_full)) < 2:
        raise ValueError("degenerate labels: need both success and failure rows")

    train_rows, test_rows, split_how = time_split(rows)
    ytr = [_label(r) for r in train_rows]
    yte = [_label(r) for r in test_rows]
    if len(set(yte)) < 2 and len(test_rows) > 0:
        # Not enough positives/negatives in the test slice to score AUC honestly.
        test_rows, yte = [], []

    encoder = FeatureEncoder().fit_vocab(rows)
    Xtr = encoder.to_matrix(train_rows)
    Xte = encoder.to_matrix(test_rows)

    logistic = train_logistic(Xtr, ytr)

    # Model selection: TabPFN if live, else the logistic fallback.
    backend = "logistic"
    classifier: Any = logistic
    tabclf = tabpfn.try_classifier()
    if tabclf is not None:
        try:
            classifier = tabclf.fit(Xtr, ytr)
            backend = "tabpfn"
        except Exception:
            classifier = logistic
            backend = "logistic"

    def _probs(model: Any, X: list[list[float]]) -> list[float]:
        if isinstance(model, LogisticModel):
            return [model.predict_proba(x) for x in X]
        return model.predict_proba(X)  # TabPFN wrapper

    chosen_metrics = _clf_metrics(yte, _probs(classifier, Xte)) if yte else {}

    # Baselines.
    bounty_scores = [_get(r, "bounty_amount") for r in test_rows]
    bounty_baseline = _ranking_metrics(yte, bounty_scores) if yte else {}
    logistic_baseline = _clf_metrics(yte, [logistic.predict_proba(x) for x in Xte]) if yte else {}
    gbt_baseline = _train_gbt_baseline(Xtr, ytr, Xte, yte) if (Xte and yte) else None
    tabpfn_baseline: Optional[dict[str, float]] = None
    if backend == "tabpfn" and yte:
        tabpfn_baseline = chosen_metrics  # chosen IS TabPFN

    # days_to_merge regressor, fit on successes only (PRD §7.1 target).
    succ_tr = [i for i, yi in enumerate(ytr) if yi == 1 and "days_to_merge" in train_rows[i]]
    regressor: Optional[Any] = None
    days_metrics: dict[str, Any] = {}
    if succ_tr:
        ydays = [float(train_rows[i]["days_to_merge"]) for i in succ_tr]
        Xs = [Xtr[i] for i in succ_tr]
        reg = tabpfn.try_regressor()
        if reg is not None:
            try:
                regressor = reg.fit(Xs, ydays)
            except Exception:
                regressor = train_ridge(Xs, ydays)
        else:
            regressor = train_ridge(Xs, ydays)

        def _pred_days(model: Any, x: list[float]) -> float:
            if isinstance(model, RidgeModel):
                return model.predict(x)
            return float(model.predict([x])[0])  # TabPFN regressor

        succ_te = [i for i, yi in enumerate(yte) if yi == 1 and "days_to_merge" in test_rows[i]]
        if succ_te:
            errs = [
                abs(_pred_days(regressor, Xte[i]) - float(test_rows[i]["days_to_merge"]))
                for i in succ_te
            ]
            days_metrics = {
                "maeDays": round(sum(errs) / len(errs), 2),
                "n": len(errs),
            }

    version = f"{backend}-v1"
    metrics = {
        "modelVersion": version,
        "backend": backend,
        "split": split_how,
        "testFrac": TEST_FRAC,
        "nTrain": len(train_rows),
        "nTest": len(test_rows),
        "positives": sum(ytr_full) + sum(yte),
        "negatives": len(rows) - (sum(ytr_full) + sum(yte)),
        "classBalance": round(sum(ytr_full + yte) / len(rows), 4) if rows else 0.0,
        "chosen": chosen_metrics,
        "baselines": {
            "bountyOnly": bounty_baseline,
            "logistic": logistic_baseline,
            "gradientBoosted": gbt_baseline,
            "tabpfn": tabpfn_baseline,
        },
        "daysToMerge": days_metrics,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
    }

    state.set_active(
        state.ModelBundle(
            version=version,
            encoder=encoder,
            classifier=classifier,
            regressor=regressor,
            backend=backend,
            metrics=metrics,
            trained_at=metrics["trainedAt"],
        )
    )
    return metrics
