// Normalizes a Mediapipe hand (21 landmarks) to match the CSV/model prep:
// - Translate so the wrist (index 0) is the origin
// - Scale by hand span (max-min in x/y)
// - Flatten to 63 floats [x1,y1,z1,x2,y2,z2,...]
// Note: optional left-hand mirroring is supported to align with right-hand training data.
export function normalizeLandmarks(hand, handedness = "", handednessScore = 1, options = {}) {
  if (!hand || hand.length !== 21) return null;
  const pts = hand.map((p) => [p.x, p.y, p.z || 0]);
  const mirrorLeft = !!options.mirrorLeft;
  const isLeft =
    typeof handedness === "string" && handedness.toLowerCase().startsWith("left");
  const base = pts[0];
  const shifted = pts.map(([x, y, z]) => {
    let dx = x - base[0];
    if (mirrorLeft && isLeft) dx = -dx;
    const dy = y - base[1];
    const dz = z - base[2];
    return [dx, dy, dz];
  });
  const indexMcp = shifted[5];
  const middleMcp = shifted[9];
  const pinkyMcp = shifted[17];
  const vec = (a, b) => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const norm = (v) => Math.hypot(v[0], v[1], v[2]);
  const normalize = (v) => {
    const n = norm(v) || 1e-6;
    return [v[0] / n, v[1] / n, v[2] / n];
  };
  let rotated = shifted;
  if (indexMcp && middleMcp && pinkyMcp) {
    const xAxis = normalize(vec(indexMcp, pinkyMcp));
    let yAxis = normalize(vec([0, 0, 0], middleMcp));
    let zAxis = cross(xAxis, yAxis);
    if (norm(zAxis) < 1e-6) {
      yAxis = normalize(vec([0, 0, 0], indexMcp));
      zAxis = cross(xAxis, yAxis);
    }
    zAxis = normalize(zAxis);
    yAxis = normalize(cross(zAxis, xAxis));
    rotated = shifted.map((p) => [
      dot(p, xAxis),
      dot(p, yAxis),
      dot(p, zAxis),
    ]);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  rotated.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });

  const spanXY = Math.hypot(maxX - minX, maxY - minY) || 1e-6;
  const spanIndexPinky =
    indexMcp && pinkyMcp ? norm(vec(indexMcp, pinkyMcp)) : spanXY;
  const spanWristMiddle = middleMcp ? norm(vec([0, 0, 0], middleMcp)) : spanXY;
  const span = Math.max(spanXY, spanIndexPinky, spanWristMiddle, 1e-6);
  const normalized = rotated.flatMap(([x, y, z]) => [x / span, y / span, z / span]);
  return normalized; // length 63
}

export const FULL_LABEL_SET = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T",
  "U","V","W","X","Y","Z","del","space","nothing",
];     
