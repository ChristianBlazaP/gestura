import sys
import json
import math
import numpy as np
import joblib
from pathlib import Path

MODEL_PATH = Path(__file__).with_name("asl_model.joblib")
CENTROIDS_PATH = Path(__file__).with_name("centroids.json")
DEFAULT_LABELS = [
    "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T",
    "U","V","W","X","Y","Z","del","space","nothing",
]

try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    sys.stderr.write(f"Failed to load model: {e}\n")
    sys.stderr.flush()
    sys.exit(1)

LABELS = list(getattr(model, "classes_", DEFAULT_LABELS))

centroids = {}
try:
    with open(CENTROIDS_PATH, "r", encoding="utf-8") as f:
        centroids = json.load(f).get("centroids", {})
except Exception as e:
    sys.stderr.write(f"Centroids not loaded: {e}\n")
    sys.stderr.flush()
    centroids = {}

NON_LETTER_LABELS = {"del", "space", "nothing"}
CONFUSION_GROUPS = [
    {"labels": ["M", "N", "S", "T"], "margin": 0.14, "ratio": 0.9},
    {"labels": ["C", "O", "P", "Q"], "margin": 0.14, "ratio": 0.92},
    {"labels": ["U", "V"], "margin": 0.18, "ratio": 0.9},
    {"labels": ["D", "X"], "margin": 0.18, "ratio": 0.9},
]


def _distance(a, b):
    return math.sqrt(sum((ai - bi) ** 2 for ai, bi in zip(a, b)))


def _best_centroid(features):
    if not centroids:
        return None, None
    best_label = None
    best_dist = None
    for label, vec in centroids.items():
        if label in NON_LETTER_LABELS:
            continue
        dist = _distance(features, vec)
        if best_dist is None or dist < best_dist:
            best_dist = dist
            best_label = label
    return best_label, best_dist


def _rerank_with_centroids(features, top1_label, top2_label, margin):
    if not centroids:
        return top1_label, None
    candidate_labels = set()
    group_meta = None
    for group in CONFUSION_GROUPS:
        if top1_label in group["labels"] or top2_label in group["labels"]:
            group_meta = group
            candidate_labels = {l for l in group["labels"] if l in centroids}
            break
    if not candidate_labels:
        return top1_label, None
    distances = {label: _distance(features, centroids[label]) for label in candidate_labels}
    best_label, best_dist = sorted(distances.items(), key=lambda x: x[1])[0]
    top1_dist = distances.get(top1_label)
    second_dist = sorted(distances.values())[1] if len(distances) > 1 else best_dist
    dist_margin = (second_dist - best_dist) / max(second_dist, 1e-6)
    ratio_ok = top1_dist is not None and best_dist < top1_dist * group_meta["ratio"]
    margin_ok = margin < group_meta["margin"]
    if best_label != top1_label and (ratio_ok or margin_ok):
        return best_label, {"dist_margin": dist_margin, "dist_best": best_dist, "dist_top1": top1_dist}
    return top1_label, {"dist_margin": dist_margin, "dist_best": best_dist, "dist_top1": top1_dist}


def predict(features):
    arr = np.array(features, dtype=np.float32).reshape(1, -1)
    probs = model.predict_proba(arr)[0]
    top1_idx = int(np.argmax(probs))
    top1_label = LABELS[top1_idx]
    top1_conf = float(probs[top1_idx])
    top2_idx = int(np.argsort(probs)[-2])
    top2_label = LABELS[top2_idx]
    top2_conf = float(probs[top2_idx])
    margin = float(top1_conf - top2_conf)
    chosen_label, meta = _rerank_with_centroids(features, top1_label, top2_label, margin)
    centroid_label, centroid_dist = _best_centroid(features)
    top1_dist = _distance(features, centroids[top1_label]) if centroids and top1_label in centroids else None
    reranked = chosen_label != top1_label
    if (
        centroid_label
        and centroid_label != chosen_label
        and (top1_conf < 0.8 or margin < 0.12)
        and top1_dist is not None
        and centroid_dist is not None
        and centroid_dist < top1_dist * 0.88
    ):
        chosen_label = centroid_label
        reranked = True
    dist_margin = (meta or {}).get("dist_margin", 0.0)
    chosen_conf = top1_conf
    chosen_margin = margin
    if reranked:
        chosen_conf = max(top1_conf, top2_conf, min(0.95, 0.75 + dist_margin * 0.2))
        chosen_margin = max(margin, min(0.25, dist_margin * 0.25))
    return {
        "label": chosen_label,
        "confidence": chosen_conf,
        "top2_label": top2_label,
        "top2_confidence": top2_conf,
        "margin": chosen_margin,
        "reranked": reranked,
        "centroid_label": centroid_label,
    }


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            continue
        req_id = req.get("id")
        feats = req.get("features", [])
        if not isinstance(feats, (list, tuple)) or len(feats) != 63:
            resp = {"id": req_id, "error": "features must be length 63"}
        else:
            try:
                resp = {"id": req_id, **predict(feats)}
            except Exception as e:
                resp = {"id": req_id, "error": f"inference_failed: {e}"}
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
