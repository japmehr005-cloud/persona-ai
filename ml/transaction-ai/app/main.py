"""FastAPI inference service for Transaction Intelligence."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.pipeline import TransactionClassifier

classifier: TransactionClassifier | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global classifier
    classifier = TransactionClassifier()
    yield
    classifier = None


app = FastAPI(
    title="Persona AI Transaction Intelligence",
    version="1.0.0",
    lifespan=lifespan,
)


class ClassifyRequest(BaseModel):
    narration: str = Field(..., min_length=1, max_length=2000)


class ProbabilityItem(BaseModel):
    label: str
    p: float


class ClassifyResponse(BaseModel):
    category: str
    confidence: float
    probabilities: list[ProbabilityItem]
    model: str | None = None


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "model_loaded": classifier is not None,
        "model": classifier.model_name if classifier else None,
    }


@app.post("/api/ai/classify-transaction", response_model=ClassifyResponse)
def classify_transaction(body: ClassifyRequest) -> ClassifyResponse:
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    result = classifier.classify(body.narration)
    return ClassifyResponse(**result)
