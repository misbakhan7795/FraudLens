
from pathlib import Path
from functools import lru_cache
from io import BytesIO
import json

import joblib
import numpy as np
import pandas as pd

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


# --------------------------------------------------
# 1. Project Configuration
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
RESULTS_DIR = BASE_DIR / "results"
MODELS_DIR = BASE_DIR / "models"

app = FastAPI(
    title="FraudLens API",
    description="Financial Risk Intelligence and Fraud Analytics",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)


# --------------------------------------------------
# 2. Load Analytics and Configuration
# --------------------------------------------------

with open(RESULTS_DIR / "dashboard_data.json") as f:
    analytics = json.load(f)

FEATURES = analytics["feature_names"]

MODEL_FILES = {
    "Logistic Regression": "logistic_regression.joblib",
    "Random Forest": "random_forest.joblib",
    "XGBoost": "xgboost.joblib"
}

BEST_MODEL = analytics["best_model"]["model"]
BEST_THRESHOLD = analytics["best_model"]["threshold"]

samples = pd.read_csv(
    RESULTS_DIR / "sample_transactions.csv"
)

app.mount(
    "/visualizations",
    StaticFiles(directory=BASE_DIR / "visualizations"),
    name="visualizations"
)


# --------------------------------------------------
# 3. Model Loading
# --------------------------------------------------

@lru_cache(maxsize=3)
def load_model(name):

    if name not in MODEL_FILES:
        raise HTTPException(400, "Unknown model")

    return joblib.load(
        MODELS_DIR / MODEL_FILES[name]
    )


# --------------------------------------------------
# 4. Input Validation
# --------------------------------------------------

def validate_features(data):

    missing = [
        col for col in FEATURES
        if col not in data.columns
    ]

    if missing:
        raise HTTPException(
            400,
            detail={"missing_features": missing}
        )

    try:
        data = data[FEATURES].apply(
            pd.to_numeric,
            errors="raise"
        )
    except (ValueError, TypeError):
        raise HTTPException(
            400, "Features must be numeric"
        )

    if not np.isfinite(data.to_numpy()).all():
        raise HTTPException(
            400, "Missing or invalid numeric values"
        )

    return data


class PredictionRequest(BaseModel):

    features: dict[str, float]

    model: str = BEST_MODEL

    threshold: float | None = Field(
        default=None,
        ge=0,
        le=1
    )


# --------------------------------------------------
# 5. Health Check
# --------------------------------------------------

@app.get("/")
def root():

    return {
        "application": "FraudLens",
        "status": "operational",
        "version": "1.0.0",
        "best_model": BEST_MODEL,
        "optimal_threshold": BEST_THRESHOLD
    }


# --------------------------------------------------
# 6. Analytics Endpoints
# --------------------------------------------------

@app.get("/api/analytics")
def get_analytics():
    return analytics


@app.get("/api/overview")
def get_overview():
    return analytics["overview"]


@app.get("/api/models")
def get_models():
    return analytics["models"]


@app.get("/api/thresholds")
def get_thresholds():
    return analytics["threshold_analysis"]


@app.get("/api/feature-importance")
def get_feature_importance():
    return analytics["feature_importance"]


@app.get("/api/financial-impact")
def get_financial_impact():
    return analytics["financial_impact"]


@app.get("/api/hourly-analysis")
def get_hourly_analysis():
    return analytics["hourly_analysis"]


# --------------------------------------------------
# 7. Sample Transactions
# --------------------------------------------------

@app.get("/api/samples")
def get_samples():

    output = []

    for index, row in samples.iterrows():

        output.append({
            "id": int(index),
            "amount": float(row["Amount"]),
            "actual_class": int(row["actual_class"]),
            "features": {
                col: float(row[col])
                for col in FEATURES
            }
        })

    return output


# --------------------------------------------------
# 8. Individual Fraud Prediction
# --------------------------------------------------

@app.post("/api/predict")
def predict(request: PredictionRequest):

    model = load_model(request.model)

    data = validate_features(
        pd.DataFrame([request.features])
    )

    threshold = request.threshold

    if threshold is None:

        threshold = (
            BEST_THRESHOLD
            if request.model == BEST_MODEL
            else 0.5
        )

    score = float(
        model.predict_proba(data)[0, 1]
    )

    prediction = int(score >= threshold)

    return {
        "model": request.model,
        "fraud_score": score,
        "prediction": prediction,
        "threshold": threshold,
        "classification": (
            "Potential Fraud"
            if prediction == 1
            else "Legitimate"
        )
    }


# --------------------------------------------------
# 9. Batch CSV Fraud Prediction
# --------------------------------------------------

@app.post("/api/predict-batch")
async def predict_batch(
    file: UploadFile = File(...),
    model: str = BEST_MODEL
):

    if not (file.filename or "").lower().endswith(".csv"):

        raise HTTPException(
            400, "Upload a CSV file"
        )

    content = await file.read(10_000_001)

    if len(content) > 10_000_000:

        raise HTTPException(
            413, "Maximum file size is 10 MB"
        )

    try:
        data = pd.read_csv(BytesIO(content))

    except Exception:

        raise HTTPException(
            400, "Invalid CSV file"
        )

    if len(data) == 0 or len(data) > 10000:

        raise HTTPException(
            400,
            "CSV must contain 1 to 10,000 rows"
        )

    features = validate_features(data)

    classifier = load_model(model)

    threshold = (
        BEST_THRESHOLD
        if model == BEST_MODEL
        else 0.5
    )

    scores = classifier.predict_proba(
        features
    )[:, 1]

    predictions = (
        scores >= threshold
    ).astype(int)

    output = []

    for i in range(len(data)):

        output.append({
            "transaction_id": i + 1,
            "amount": float(
                features.iloc[i]["Amount"]
            ),
            "fraud_score": float(scores[i]),
            "prediction": int(predictions[i]),
            "classification": (
                "Potential Fraud"
                if predictions[i] == 1
                else "Legitimate"
            )
        })

    return {
        "model": model,
        "threshold": threshold,
        "total_transactions": len(data),
        "flagged_transactions": int(
            predictions.sum()
        ),
        "legitimate_transactions": int(
            len(data) - predictions.sum()
        ),
        "results": output
    }
