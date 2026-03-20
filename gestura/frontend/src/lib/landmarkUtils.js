export function extractLandmarks(results) {
  const maxHands = 2;
  const L = [];

  for (let i = 0; i < maxHands; ++i) {
    const hand = results.multiHandLandmarks?.[i];
    if (!hand) {
      L.push(...Array(21 * 3).fill(0));
    } else {
      for (const lm of hand) {
        L.push(lm.x, lm.y, lm.z);
      }
    }
  }

  return new Float32Array(L); // 126 values
}
