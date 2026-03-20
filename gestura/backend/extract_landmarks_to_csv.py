import argparse
import glob
import os
import random

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd


def normalize_landmarks(lms, mirror_left=False, handedness=""):
    if not lms or len(lms) != 21:
        return None
    pts = np.array([[p.x, p.y, p.z] for p in lms], dtype=np.float32)
    base = pts[0]
    pts = pts - base

    if mirror_left and handedness.lower().startswith("left"):
        pts[:, 0] = -pts[:, 0]

    index_mcp = pts[5]
    middle_mcp = pts[9]
    pinky_mcp = pts[17]

    def vec(a, b):
        return b - a

    def norm(v):
        return float(np.linalg.norm(v)) or 1e-6

    def normalize(v):
        n = norm(v)
        return v / n

    rotated = pts
    if index_mcp is not None and middle_mcp is not None and pinky_mcp is not None:
        x_axis = normalize(vec(index_mcp, pinky_mcp))
        y_axis = normalize(vec(np.zeros(3, dtype=np.float32), middle_mcp))
        z_axis = np.cross(x_axis, y_axis)
        if norm(z_axis) < 1e-6:
            y_axis = normalize(vec(np.zeros(3, dtype=np.float32), index_mcp))
            z_axis = np.cross(x_axis, y_axis)
        z_axis = normalize(z_axis)
        y_axis = normalize(np.cross(z_axis, x_axis))
        rotated = np.array(
            [[np.dot(p, x_axis), np.dot(p, y_axis), np.dot(p, z_axis)] for p in pts],
            dtype=np.float32,
        )

    xs = rotated[:, 0]
    ys = rotated[:, 1]
    span_xy = float(np.hypot(xs.max() - xs.min(), ys.max() - ys.min())) or 1e-6
    span_index = norm(vec(index_mcp, pinky_mcp)) if index_mcp is not None else span_xy
    span_middle = norm(vec(np.zeros(3, dtype=np.float32), middle_mcp)) if middle_mcp is not None else span_xy
    span = max(span_xy, span_index, span_middle, 1e-6)
    normalized = rotated / span
    return normalized.flatten().tolist()


def process_image(hands, path, mirror_left):
    img = cv2.imread(path)
    if img is None:
        return None, None
    res = hands.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    if not res.multi_hand_landmarks:
        return None, None
    handedness_label = ""
    if res.multi_handedness:
        handedness_label = res.multi_handedness[0].classification[0].label
    feats = normalize_landmarks(res.multi_hand_landmarks[0].landmark, mirror_left, handedness_label)
    return feats, handedness_label


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--img-root", required=True, help="Root folder of label subfolders.")
    parser.add_argument("--out-csv", required=True, help="Output CSV path.")
    parser.add_argument("--max-per-label", type=int, default=600, help="Cap samples per label.")
    parser.add_argument("--exclude", nargs="*", default=["J", "Z"], help="Labels to skip.")
    parser.add_argument("--mirror-left", action="store_true", help="Mirror left-hand samples.")
    args = parser.parse_args()

    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        static_image_mode=True,
        max_num_hands=1,
        model_complexity=1,
        min_detection_confidence=0.5,
    )

    rows = []
    label_dirs = [d for d in glob.glob(os.path.join(args.img_root, "*")) if os.path.isdir(d)]
    for label_dir in sorted(label_dirs):
        label = os.path.basename(label_dir)
        if label in set(args.exclude):
            continue
        images = glob.glob(os.path.join(label_dir, "*.*"))
        random.shuffle(images)
        used = 0
        for img_path in images:
            if used >= args.max_per_label:
                break
            feats, _ = process_image(hands, img_path, args.mirror_left)
            if feats is None:
                continue
            row = {"label": label}
            row.update({f"f{i}": float(v) for i, v in enumerate(feats)})
            rows.append(row)
            used += 1
        print(f"{label}: {used} samples")

    df = pd.DataFrame(rows)
    df.to_csv(args.out_csv, index=False)
    print(f"Saved {len(rows)} samples to {args.out_csv}")


if __name__ == "__main__":
    main()
