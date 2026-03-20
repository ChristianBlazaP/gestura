import json
import os
import sys

import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import LogisticRegression

DEFAULT_CSV = r"C:\Users\admin\Downloads\dataset new\hand_landmarks_normalized.csv"
MODEL_OUT = os.path.join(os.path.dirname(__file__), "asl_model.joblib")
CENTROIDS_OUT = os.path.join(os.path.dirname(__file__), "centroids.json")


def build_centroids(features, labels):
    sums = {}
    counts = {}
    for vec, label in zip(features, labels):
        if label not in sums:
            sums[label] = [0.0] * 63
            counts[label] = 0
        for i, v in enumerate(vec):
            sums[label][i] += v
        counts[label] += 1
    centroids = {}
    for label, vec in sums.items():
        count = max(counts.get(label, 1), 1)
        centroids[label] = [v / count for v in vec]
    return centroids, counts


def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    df = pd.read_csv(csv_path)
    df = df[df["label"].astype(str).str.len() == 1]
    df = df[~df["label"].isin(["J", "Z"])]
    feature_cols = [f"f{i}" for i in range(63)]
    X = df[feature_cols].values
    y = df["label"].values

    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    clf = make_pipeline(
        StandardScaler(),
        LogisticRegression(max_iter=800, multi_class="auto"),
    )
    clf.fit(Xtr, ytr)
    acc = clf.score(Xte, yte)
    print(f"Validation accuracy: {acc:.4f}")

    joblib.dump(clf, MODEL_OUT)
    centroids, counts = build_centroids(X, y)
    with open(CENTROIDS_OUT, "w", encoding="utf-8") as f:
        json.dump({"centroids": centroids, "counts": counts}, f)

    print(f"Saved model to {MODEL_OUT}")
    print(f"Saved centroids to {CENTROIDS_OUT}")
    print(f"Label counts: {counts}")


if __name__ == "__main__":
    main()
