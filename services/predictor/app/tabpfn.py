"""Optional TabPFN backend (Prior Labs `tabpfn-client`, PRD §3/§7).

We present a tiny uniform surface — fit(X, y) / predict_proba(X) -> list[float]
of P(y=1) — so train.py / predict.py never care which backend is live. When the
package or TABPFN_TOKEN is missing we report unavailable and the caller falls
back to the pure-Python logistic model, so the sidecar always answers /predict.

Real signatures (confirmed against tabpfn-client): the classes are sklearn-style
    from tabpfn_client import TabPFNClassifier, TabPFNRegressor
    clf = TabPFNClassifier(); clf.fit(X, y); clf.predict_proba(X)[:, 1]
Auth is read from the TABPFN_TOKEN environment variable by the client itself.
Note: the free key is non-commercial (see README / PRD §13).
"""
from __future__ import annotations

import os
from typing import Any, Optional


class TabPFNUnavailable(RuntimeError):
    pass


def _import_client() -> tuple[Any, Any]:
    from tabpfn_client import TabPFNClassifier, TabPFNRegressor  # type: ignore

    return TabPFNClassifier, TabPFNRegressor


def available() -> bool:
    """True only if the package imports AND a token is configured."""
    if not os.environ.get("TABPFN_TOKEN"):
        return False
    try:
        _import_client()
        return True
    except Exception:
        return False


class TabPFNClassifierBackend:
    """Wrap TabPFNClassifier behind predict_proba(X) -> list[P(y=1)]."""

    def __init__(self) -> None:
        if not available():
            raise TabPFNUnavailable("tabpfn_client or TABPFN_TOKEN not available")
        TabPFNClassifier, _ = _import_client()
        self._clf: Any = TabPFNClassifier()
        self._classes: Optional[list[Any]] = None

    def fit(self, X: list[list[float]], y: list[int]) -> "TabPFNClassifierBackend":
        if not X:
            raise TabPFNUnavailable("cannot fit TabPFN on empty data")
        self._clf.fit(X, y)
        self._classes = list(getattr(self._clf, "classes_", [0, 1]))
        return self

    def predict_proba(self, X: list[list[float]]) -> list[float]:
        probs = self._clf.predict_proba(X)
        # Column index of the positive class (label 1).
        try:
            pos = self._classes.index(1) if self._classes else 1
        except ValueError:
            pos = probs.shape[1] - 1
        return [float(row[pos]) for row in probs]


class TabPFNRegressorBackend:
    """Wrap TabPFNRegressor behind predict(X) -> list[float]."""

    def __init__(self) -> None:
        if not available():
            raise TabPFNUnavailable("tabpfn_client or TABPFN_TOKEN not available")
        _, TabPFNRegressor = _import_client()
        self._reg: Any = TabPFNRegressor()

    def fit(self, X: list[list[float]], y: list[float]) -> "TabPFNRegressorBackend":
        if not X:
            raise TabPFNUnavailable("cannot fit TabPFN on empty data")
        self._reg.fit(X, y)
        return self

    def predict(self, X: list[list[float]]) -> list[float]:
        return [float(v) for v in self._reg.predict(X)]


def try_classifier() -> Optional[TabPFNClassifierBackend]:
    try:
        return TabPFNClassifierBackend()
    except Exception:
        return None


def try_regressor() -> Optional[TabPFNRegressorBackend]:
    try:
        return TabPFNRegressorBackend()
    except Exception:
        return None
