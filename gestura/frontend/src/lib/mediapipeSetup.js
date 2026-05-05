import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export function initHands(videoElement, onResults) {
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  hands.onResults(onResults);

  const camera = new Camera(videoElement, {
    onFrame: async () => await hands.send({ image: videoElement }),
    width: 640,
    height: 480
  });

  camera.start();

  return hands;
}