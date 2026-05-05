import json
import math
import os
import sys

import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import LogisticRegression

DEFAULT_CSV = r"C:\Users\admin\Downloads\datasets\hand_landmarks_normalized.csv"
MODEL_OUT = os.path.join(os.path.dirname(__file__), "asl_model.joblib")
CENTROIDS_OUT = os.path.join(os.path.dirname(__file__), "centroids.json")


def normalize_features(vec):
    pts = [vec[i : i + 3] for i in range(0, 63, 3)]
    index_mcp = pts[5]
    middle_mcp = pts[9]
    pinky_mcp = pts[17]

    def vec3(a, b):
        return [b[0] - a[0], b[1] - a[1], b[2] - a[2]]

    def dot(a, b):
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

    def cross(a, b):
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        ]

    def norm(a):
        return math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2)

    def normalize(a):
        n = norm(a) or 1e-6
        return [a[0] / n, a[1] / n, a[2] / n]

    rotated = pts
    if index_mcp and middle_mcp and pinky_mcp:
        x_axis = normalize(vec3(index_mcp, pinky_mcp))
        y_axis = normalize(vec3([0, 0, 0], middle_mcp))
        z_axis = cross(x_axis, y_axis)
        if norm(z_axis) < 1e-6:
            y_axis = normalize(vec3([0, 0, 0], index_mcp))
            z_axis = cross(x_axis, y_axis)
        z_axis = normalize(z_axis)
        y_axis = normalize(cross(z_axis, x_axis))
        rotated = [
            [dot(p, x_axis), dot(p, y_axis), dot(p, z_axis)] for p in pts
        ]

    xs = [p[0] for p in rotated]
    ys = [p[1] for p in rotated]
    span_xy = math.hypot(max(xs) - min(xs), max(ys) - min(ys)) or 1e-6
    span_index = norm(vec3(index_mcp, pinky_mcp)) if index_mcp and pinky_mcp else span_xy
    span_middle = norm(vec3([0, 0, 0], middle_mcp)) if middle_mcp else span_xy
    span = max(span_xy, span_index, span_middle, 1e-6)

    out = []
    for x, y, z in rotated:
        out.extend([x / span, y / span, z / span])
    return out


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
    X_raw = df.filter(like="f").values
    y = df["label"].values

    X = [normalize_features(row.tolist()) for row in X_raw]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    clf = make_pipeline(StandardScaler(), LogisticRegression(max_iter=500, multi_class="auto"))
    clf.fit(Xtr, ytr)
    joblib.dump(clf, MODEL_OUT)

    centroids, counts = build_centroids(X, y)
    with open(CENTROIDS_OUT, "w", encoding="utf-8") as f:
        json.dump({"centroids": centroids, "counts": counts}, f)

    print(f"Saved model to {MODEL_OUT}")
    print(f"Saved centroids to {CENTROIDS_OUT}")


if __name__ == "__main__":
    main()
