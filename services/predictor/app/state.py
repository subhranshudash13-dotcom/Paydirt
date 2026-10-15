"""In-process model registry for the sidecar (PRD §7.4).

The API/worker calls /train and the fitted bundle lives here until the next
train. It is intentionally simple: a single active bundle. A production build
would persist bundles to object storage keyed by model_version.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ModelBundle:
    version: str
    encoder: Any
    classifier: Any                       # LogisticModel or TabPFN wrapper
    regressor: Optional[Any] = None       # days_to_merge predictor
    backend: str = "logistic"             # "tabpfn" | "logistic"
    metrics: dict[str, Any] = field(default_factory=dict)
    trained_at: Optional[str] = None


ACTIVE: Optional[ModelBundle] = None


def set_active(bundle: ModelBundle) -> None:
    global ACTIVE
    ACTIVE = bundle


def get_active() -> Optional[ModelBundle]:
    return ACTIVE
