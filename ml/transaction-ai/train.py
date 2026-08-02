"""
Train Transaction Intelligence classifiers on labelled narration data.

Produces artifacts/ + plots/ for the FastAPI inference service.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder
from sklearn.svm import LinearSVC

from evaluate import (
    compute_metrics,
    plot_confusion_matrix,
    plot_model_comparison,
    plot_roc_ovr,
    save_metrics,
)

SEED = 42
ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
DATA_PATH = REPO_ROOT / "training_data_for_ai" / "financial_transaction_test.csv"
ARTIFACTS = ROOT / "artifacts"
PLOTS = ROOT / "plots"

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


def build_candidates() -> list[tuple[str, object]]:
    candidates: list[tuple[str, object]] = [
        (
            "logistic_regression",
            LogisticRegression(max_iter=2000, random_state=SEED, class_weight="balanced"),
        ),
        (
            "linear_svm",
            LinearSVC(random_state=SEED, class_weight="balanced", dual="auto"),
        ),
        ("naive_bayes", MultinomialNB()),
        (
            "random_forest",
            RandomForestClassifier(
                n_estimators=200,
                random_state=SEED,
                class_weight="balanced_subsample",
                n_jobs=-1,
            ),
        ),
    ]
    try:
        from lightgbm import LGBMClassifier

        candidates.append(
            (
                "lightgbm",
                LGBMClassifier(
                    random_state=SEED,
                    n_estimators=200,
                    learning_rate=0.08,
                    class_weight="balanced",
                    verbosity=-1,
                ),
            )
        )
    except Exception as exc:  # pragma: no cover - optional dependency
        print(f"[train] Skipping LightGBM: {exc}")
    return candidates


def make_vectorizer() -> TfidfVectorizer:
    return TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=2,
        max_features=5000,
        sublinear_tf=True,
    )


def main() -> int:
    if not DATA_PATH.exists():
        print(f"[train] Dataset not found: {DATA_PATH}", file=sys.stderr)
        return 1

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    PLOTS.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(DATA_PATH)
    if "Transaction_Text" not in df.columns or "Label" not in df.columns:
        print("[train] CSV must contain Transaction_Text and Label columns", file=sys.stderr)
        return 1

    df = df.dropna(subset=["Transaction_Text", "Label"]).copy()
    df["text"] = df["Transaction_Text"].map(preprocess_text)
    df = df[df["text"].str.len() > 0]

    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(df["Label"].astype(str).to_numpy())
    # Use plain Python lists — Arrow-backed pandas arrays break sklearn indexing.
    x = df["text"].astype(str).tolist()
    labels = list(label_encoder.classes_)

    x_train, x_temp, y_train, y_temp = train_test_split(
        x, y, test_size=0.30, random_state=SEED, stratify=y
    )
    x_val, x_test, y_val, y_test = train_test_split(
        x_temp, y_temp, test_size=0.50, random_state=SEED, stratify=y_temp
    )

    print(
        f"[train] rows={len(df)} train={len(x_train)} val={len(x_val)} test={len(x_test)} "
        f"labels={labels}"
    )

    val_scores: dict[str, float] = {}
    fitted: dict[str, Pipeline] = {}

    for name, clf in build_candidates():
        pipe = Pipeline(
            [
                ("tfidf", make_vectorizer()),
                ("clf", clf),
            ]
        )
        pipe.fit(x_train, y_train)
        y_val_pred = pipe.predict(x_val)
        from sklearn.metrics import f1_score

        score = float(f1_score(y_val, y_val_pred, average="macro", zero_division=0))
        val_scores[name] = score
        fitted[name] = pipe
        print(f"[train] {name}: val_f1_macro={score:.4f}")

    best_name = max(val_scores, key=val_scores.get)
    print(f"[train] Selected best model: {best_name} (val F1={val_scores[best_name]:.4f})")

    # Refit best on train+val
    x_train_val = list(x_train) + list(x_val)
    y_train_val = list(y_train) + list(y_val)
    best_clf = dict(build_candidates())[best_name]
    best_pipe = Pipeline([("tfidf", make_vectorizer()), ("clf", best_clf)])
    best_pipe.fit(x_train_val, y_train_val)

    y_test_pred = best_pipe.predict(x_test)
    metrics = compute_metrics(
        label_encoder.inverse_transform(y_test),
        label_encoder.inverse_transform(y_test_pred),
        labels,
    )
    metrics["best_model"] = best_name
    metrics["validation_f1_by_model"] = val_scores
    metrics["seed"] = SEED
    metrics["split"] = {"train": 0.70, "validation": 0.15, "test": 0.15}

    mean_auc = plot_roc_ovr(
        best_pipe,
        x_test,
        label_encoder.inverse_transform(y_test),
        labels,
        PLOTS / "roc_ovr_test.png",
    )
    if mean_auc is not None:
        metrics["roc_auc_macro_ovr"] = mean_auc

    plot_confusion_matrix(
        label_encoder.inverse_transform(y_test),
        label_encoder.inverse_transform(y_test_pred),
        labels,
        PLOTS / "confusion_matrix.png",
    )
    plot_model_comparison(val_scores, PLOTS / "val_accuracy_bar.png")

    joblib.dump(best_pipe, ARTIFACTS / "model.joblib")
    # Also dump vectorizer + classifier separately for clarity / debugging
    joblib.dump(best_pipe.named_steps["tfidf"], ARTIFACTS / "vectorizer.joblib")
    joblib.dump(best_pipe.named_steps["clf"], ARTIFACTS / "classifier.joblib")
    joblib.dump(label_encoder, ARTIFACTS / "label_encoder.joblib")
    (ARTIFACTS / "best_model.txt").write_text(best_name + "\n", encoding="utf-8")
    save_metrics(metrics, ARTIFACTS / "metrics.json")

    print(
        f"[train] test accuracy={metrics['accuracy']:.4f} "
        f"f1_macro={metrics['f1_macro']:.4f}"
    )
    print(f"[train] Artifacts written to {ARTIFACTS}")
    print(f"[train] Plots written to {PLOTS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
