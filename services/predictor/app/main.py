"""FastAPI entrypoint for the predictor sidecar (PRD §7.4, §14).

Endpoints: GET /health, POST /train, POST /predict. Traces /train and /predict
with Sentry when SENTRY_DSN is configured; otherwise runs un-instrumented so the
sidecar is dependency-light for local demo/tests.
"""
from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import tabpfn
from .predict import ModelNotTrained, predict_rows
from .state import get_active
from .train import train


def _init_sentry() -> bool:
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        return False
    try:
        import sentry_sdk  # type: ignore

        sentry_sdk.init(dsn=dsn, traces_sample_rate=1.0)  # noqa: S404
        return True
    except Exception:
        return False


SENTRY_ON = _init_sentry()

app = FastAPI(title="Paydirt Predictor", version="1.0.0")


class TrainRequest(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)


class PredictRequest(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)


class Health(BaseModel):
    status: str
    backend: str
    tabpfnAvailable: bool
    modelTrained: bool
    modelVersion: str | None
    sentry: bool


@app.get("/health", response_model=Health)
def health() -> Health:
    bundle = get_active()
    return Health(
        status="ok",
        backend=(bundle.backend if bundle else "logistic"),
        tabpfnAvailable=tabpfn.available(),
        modelTrained=bundle is not None,
        modelVersion=(bundle.version if bundle else None),
        sentry=SENTRY_ON,
    )


@app.post("/train")
def train_endpoint(req: TrainRequest) -> dict[str, Any]:
    if not req.rows:
        raise HTTPException(status_code=400, detail="rows required")
    try:
        return train(req.rows)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@app.post("/predict")
def predict_endpoint(req: PredictRequest) -> dict[str, Any]:
    if not req.rows:
        raise HTTPException(status_code=400, detail="rows required")
    try:
        return predict_rows(req.rows)
    except ModelNotTrained as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
