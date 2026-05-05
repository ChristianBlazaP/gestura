import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const MODEL_PATH = "/models/hand_landmarker.task";
const WASM_ASSET = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";

let handLandmarkerPromise = null;

export async function getHandLandmarker() {
  if (!handLandmarkerPromise) {
    handLandmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_ASSET);
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })();
  }
  return handLandmarkerPromise;
}

export function drawCameraFrame(ctx, videoEl) {
  if (!ctx || !videoEl) return;
  ctx.drawImage(videoEl, 0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function drawLandmarks(ctx, handLandmarks) {
  if (!ctx || !handLandmarks) return;
  ctx.fillStyle = "rgba(16, 185, 129, 0.95)";
  for (const p of handLandmarks) {
    ctx.beginPath();
    ctx.arc(p.x * ctx.canvas.width, p.y * ctx.canvas.height, 5, 0, 2 * Math.PI);
    ctx.fill();
  }
}

export function resizeCanvasToVideo(canvas, video) {
  if (!canvas || !video) return;
  const targetW = Math.min(video.videoWidth || 960, 1280);
  const targetH = Math.min(video.videoHeight || 720, 720);
  const needsResize = canvas.width !== targetW || canvas.height !== targetH;
  if (needsResize) {
    canvas.width = targetW || 960;
    canvas.height = targetH || 720;
  }
}
