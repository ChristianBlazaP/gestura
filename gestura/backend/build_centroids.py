import csv
import json
import os
import sys

DEFAULT_CSV = r"C:\Users\admin\Downloads\datasets\hand_landmarks_normalized.csv"
DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "centroids.json")


def build_centroids(csv_path):
    sums = {}
    counts = {}
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            label = row.get("label")
            if not label:
                continue
            feats = [float(row.get(f"f{i}", 0.0)) for i in range(63)]
            if label not in sums:
                sums[label] = [0.0] * 63
                counts[label] = 0
            for i, v in enumerate(feats):
                sums[label][i] += v
            counts[label] += 1
    centroids = {}
    for label, vec in sums.items():
        count = max(counts.get(label, 1), 1)
        centroids[label] = [v / count for v in vec]
    return centroids, counts


def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    out_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV not found: {csv_path}")
    centroids, counts = build_centroids(csv_path)
    payload = {"centroids": centroids, "counts": counts}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    print(f"Saved centroids for {len(centroids)} labels to {out_path}")


if __name__ == "__main__":
    main()
