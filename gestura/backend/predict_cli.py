import sys
import json
import numpy as np
import joblib
from pathlib import Path

# Expect JSON on stdin: {"features": [63 floats]}

MODEL_PATH = Path(__file__).with_name("asl_model.joblib")
DEFAULT_LABELS = [
    "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T",
    "U","V","W","X","Y","Z","del","space","nothing",
]

try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    sys.stderr.write(f"Failed to load model: {e}\n")
    sys.exit(1)

LABELS = list(getattr(model, "classes_", DEFAULT_LABELS))


def main():
    try:
        payload = json.load(sys.stdin)
        feats = payload.get("features", [])
    except Exception as e:
        sys.stderr.write(f"Invalid JSON: {e}\n")
        sys.exit(1)

    if not isinstance(feats, (list, tuple)) or len(feats) != 63:
        sys.stderr.write("features must be a list of length 63\n")
        sys.exit(1)

    try:
        arr = np.array(feats, dtype=np.float32).reshape(1, -1)
    except Exception as e:
        sys.stderr.write(f"Bad feature values: {e}\n")
        sys.exit(1)

    try:
        probs = model.predict_proba(arr)[0]
    except Exception as e:
        sys.stderr.write(f"Inference error: {e}\n")
        sys.exit(1)

    top1_idx = int(np.argmax(probs))
    top1_label = LABELS[top1_idx]
    top1_conf = float(probs[top1_idx])
    top2_idx = int(np.argsort(probs)[-2])
    top2_label = LABELS[top2_idx]
    top2_conf = float(probs[top2_idx])
    margin = float(top1_conf - top2_conf)

    out = {
        "label": top1_label,
        "confidence": top1_conf,
        "top2_label": top2_label,
        "top2_confidence": top2_conf,
        "margin": margin,
        "probs": {LABELS[i]: float(p) for i, p in enumerate(probs)},
    }
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
