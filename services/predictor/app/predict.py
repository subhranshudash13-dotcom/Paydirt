"""Inference (PRD §7.4). Score anonymous feature rows -> p_success, days_to_merge.

Uses the ACTIVE bundle fit by train.py. Branches on the backend so both the
pure-Python logistic/ridge fallback and the optional TabPFN wrapper present the
same output shape. Rows carry no code/usernames — only numeric features.
"""
from __future__ import annotations

from typing import Any, Optional

from .model import LogisticModel, RidgeModel
from .state import get_active


class ModelNotTrained(RuntimeError):
    pass


def _p_success(model: Any, x: list[float]) -> float:
    if isinstance(model, LogisticModel):
        return model.predict_proba(x)
    return float(model.predict_proba([x])[0])  # TabPFN wrapper


def _days(reg: Optional[Any], x: list[float]) -> Optional[float]:
    if reg is None:
        return None
    if isinstance(reg, RidgeModel):
        return max(0.1, reg.predict(x))
    return max(0.1, float(reg.predict([x])[0]))  # TabPFN regressor


def predict_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    bundle = get_active()
    if bundle is None:
        raise ModelNotTrained("no model trained yet; POST /train first")

    encoder = bundle.encoder
    X = encoder.to_matrix(rows)
    out: list[dict[str, Any]] = []
    for row, x in zip(rows, X):
        p = _p_success(bundle.classifier, x)
        days = _days(bundle.regressor, x)
        out.append(
            {
                "ref": row.get("ref") or row.get("id"),
                "pSuccess": round(p, 4),
                "daysToMergeEst": round(days, 2) if days is not None else None,
                "modelVersion": bundle.version,
            }
        )
    return {"modelVersion": bundle.version, "backend": bundle.backend, "predictions": out}
