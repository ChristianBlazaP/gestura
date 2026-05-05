import * as tf from '@tensorflow/tfjs';

export function predictFromLandmarks(model, landmarkArray) {
  const input = tf.tensor(landmarkArray).reshape([1, landmarkArray.length]);
  const pred = model.predict(input);
  const probs = pred.dataSync();
  const topIdx = probs.indexOf(Math.max(...probs));
  return {
    index: topIdx,
    confidence: probs[topIdx]
  };
}