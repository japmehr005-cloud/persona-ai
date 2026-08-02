"""Load trained artifacts and run classification."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import joblib
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"

REF_RE = re.compile(r"\|\s*Ref:[a-f0-9]+\s*", re.IGNORECASE)
AMT_RE = re.compile(r"\|\s*Amount:\s*INR\s*[\d.,]+\s*", re.IGNORECASE)
BRACKET_TAG_RE = re.compile(r"^\[[^\]]+\]\s*")


def preprocess_text(text: str) -> str:
    cleaned = str(text).strip()
    cleaned = BRACKET_TAG_RE.sub("", cleaned)
    cleaned = REF_RE.sub(" ", cleaned)
    cleaned = AMT_RE.sub(" ", cleaned)
    cleaned = cleaned.lower()
    cleaned = re.sub(r"[^a-z0-9\s/&'-]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


class TransactionClassifier:
    def __init__(self, artifacts_dir: Path | None = None) -> None:
        base = artifacts_dir or ARTIFACTS
        model_path = base / "model.joblib"
        encoder_path = base / "label_encoder.joblib"
        if not model_path.exists() or not encoder_path.exists():
            raise FileNotFoundError(
                f"Missing model artifacts in {base}. Run train.py first."
            )
        self.pipeline = joblib.load(model_path)
        self.label_encoder = joblib.load(encoder_path)
        self.labels: list[str] = list(self.label_encoder.classes_)
        best_path = base / "best_model.txt"
        self.model_name = (
            best_path.read_text(encoding="utf-8").strip() if best_path.exists() else "unknown"
        )

    def _probabilities(self, cleaned: str) -> np.ndarray:
        clf = self.pipeline.named_steps.get("clf")
        if hasattr(self.pipeline, "predict_proba"):
            try:
                return self.pipeline.predict_proba([cleaned])[0]
            except Exception:
                pass
        if clf is not None and hasattr(clf, "predict_proba"):
            try:
                features = self.pipeline.named_steps["tfidf"].transform([cleaned])
                return clf.predict_proba(features)[0]
            except Exception:
                pass
        if clf is not None and hasattr(clf, "decision_function"):
            features = self.pipeline.named_steps["tfidf"].transform([cleaned])
            scores = np.asarray(clf.decision_function(features)[0], dtype=float)
            if scores.ndim == 0:
                scores = np.array([float(scores), -float(scores)])
            # Softmax over decision scores
            shifted = scores - np.max(scores)
            exp = np.exp(shifted)
            return exp / np.sum(exp)
        # Fallback: one-hot on predicted class
        pred = int(self.pipeline.predict([cleaned])[0])
        probs = np.zeros(len(self.labels), dtype=float)
        probs[pred] = 1.0
        return probs

    def classify(self, narration: str) -> dict[str, Any]:
        cleaned = preprocess_text(narration)
        if not cleaned:
            return {
                "category": "Other",
                "confidence": 0.0,
                "probabilities": [{"label": label, "p": 0.0} for label in self.labels],
                "model": self.model_name,
            }

        probs = self._probabilities(cleaned)
        # Align length if needed
        if len(probs) != len(self.labels):
            pred_idx = int(self.pipeline.predict([cleaned])[0])
            category = self.labels[pred_idx] if pred_idx < len(self.labels) else "Other"
            return {
                "category": category,
                "confidence": 1.0,
                "probabilities": [{"label": category, "p": 1.0}],
                "model": self.model_name,
            }

        order = np.argsort(probs)[::-1]
        top_idx = int(order[0])
        category = self.labels[top_idx]
        confidence = float(probs[top_idx])
        probabilities = [
            {"label": self.labels[int(i)], "p": float(probs[int(i)])} for i in order
        ]
        return {
            "category": category,
            "confidence": confidence,
            "probabilities": probabilities,
            "model": self.model_name,
        }
