import { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import * as tf from '@tensorflow/tfjs';
import * as knnClassifier from '@tensorflow-models/knn-classifier';

const classifier = knnClassifier.create();

// Landmark connection pairs for palm visualization
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],           // Index
  [0, 9], [9, 10], [10, 11], [11, 12],       // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],     // Ring
  [0, 17], [17, 18], [18, 19], [19, 20],     // Pinky
  [5, 9], [9, 13], [13, 17]                  // Palm base connections
];

// Landmark smoothing using exponential moving average
class LandmarkSmoother {
  constructor(alpha = 0.7) {
    this.alpha = alpha;
    this.prevLandmarks = null;
  }

  smooth(landmarks) {
    if (!landmarks) return null;
    
    if (!this.prevLandmarks) {
      this.prevLandmarks = landmarks.map(lm => ({ ...lm }));
      return landmarks;
    }

    return landmarks.map((lm, i) => ({
      x: this.alpha * lm.x + (1 - this.alpha) * this.prevLandmarks[i].x,
      y: this.alpha * lm.y + (1 - this.alpha) * this.prevLandmarks[i].y,
      z: this.alpha * (lm.z ?? 0) + (1 - this.alpha) * (this.prevLandmarks[i].z ?? 0),
      visibility: lm.visibility ?? 0.5
    }));
  }
}

export default function WebcamInterpreter(props) {
  const { onSaveGesture, onPrediction } = props;
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const samplesRef = useRef([]);
  const smootherRef = useRef(new LandmarkSmoother(0.7));
  const [label, setLabel] = useState('hello');
  const [isRecording, setIsRecording] = useState(false);
  const [prediction, setPrediction] = useState('—');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [lastSpoken, setLastSpoken] = useState(0);
  const [detectionConfidence, setDetectionConfidence] = useState(0.85);

  // Normalize landmarks to [-1, 1] range for better model accuracy
  function normalizeLandmarks(landmarks) {
    if (!landmarks || landmarks.length === 0) return null;
    
    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const lm of landmarks) {
      minX = Math.min(minX, lm.x);
      maxX = Math.max(maxX, lm.x);
      minY = Math.min(minY, lm.y);
      maxY = Math.max(maxY, lm.y);
    }
    
    const rangeX = maxX - minX || 0.1;
    const rangeY = maxY - minY || 0.1;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Normalize to [-1, 1] range
    return landmarks.map(lm => ({
      x: ((lm.x - centerX) / (rangeX / 2)),
      y: ((lm.y - centerY) / (rangeY / 2)),
      z: (lm.z ?? 0) * 2, // Scale z-depth
      visibility: lm.visibility ?? 0.5
    }));
  }

  function landmarksToArray(landmarks) {
    if (!landmarks) return null;
    const arr = [];
    for (const lm of landmarks) {
      arr.push(lm.x, lm.y, lm.z ?? 0);
    }
    return arr;
  }

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      staticImageMode: false,
      minDetectionConfidence: detectionConfidence,  // High confidence for accurate detection
      minTrackingConfidence: 0.8,                    // High confidence for stable tracking
    });

    async function onResults(results) {
      if (!canvasRef.current || !videoRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const v = videoRef.current;
      if (canvasRef.current.width !== v.videoWidth || canvasRef.current.height !== v.videoHeight) {
        canvasRef.current.width = v.videoWidth;
        canvasRef.current.height = v.videoHeight;
      }

      ctx.save();
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(v, 0, 0, ctx.canvas.width, ctx.canvas.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        let lm = results.multiHandLandmarks[0];
        
        // Apply smoothing to reduce jitter
        lm = smootherRef.current.smooth(lm);
        
        // Normalize landmarks for better accuracy
        const normalizedLm = normalizeLandmarks(lm);

        // Draw landmark connections (palm structure)
        ctx.strokeStyle = 'rgba(100,200,150,0.5)';
        ctx.lineWidth = 2;
        for (const [start, end] of HAND_CONNECTIONS) {
          if (lm[start] && lm[end]) {
            ctx.beginPath();
            ctx.moveTo(lm[start].x * ctx.canvas.width, lm[start].y * ctx.canvas.height);
            ctx.lineTo(lm[end].x * ctx.canvas.width, lm[end].y * ctx.canvas.height);
            ctx.stroke();
          }
        }

        // Draw landmarks as circles
        ctx.fillStyle = 'rgba(0,200,150,0.95)';
        for (let i = 0; i < lm.length; i++) {
          const p = lm[i];
          const size = i === 0 ? 8 : 6; // Palm center is slightly larger
          ctx.beginPath();
          ctx.arc(p.x * ctx.canvas.width, p.y * ctx.canvas.height, size, 0, 2 * Math.PI);
          ctx.fill();
        }

        // Use normalized landmarks for gesture recognition
        const arr = landmarksToArray(normalizedLm);
        if (arr) {
          if (isRecording) samplesRef.current.push(arr);

          const t = tf.tensor(arr, [1, arr.length]);
          if (classifier.getNumClasses() > 0 && !isRecording) {
            try {
              const res = await classifier.predictClass(t);
              const labelPred = res.label;
              setPrediction(labelPred);
              onPrediction && onPrediction(labelPred);

              const conf = (res.confidences && res.confidences[res.label]) ?? 0;
              const now = Date.now();
              if (conf > 0.7 && now - lastSpoken > 1000) {
                try {
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.speak(new SpeechSynthesisUtterance(labelPred));
                  setLastSpoken(now);
                } catch {}
              }
            } catch (err) {
              // ignore
            }
          }
          t.dispose();
        }
      } else {
        setPrediction('—');
      }

      ctx.restore();
    }

    hands.onResults(onResults);

    let camera = null;
    if (videoRef.current) {
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          try {
            await hands.send({ image: videoRef.current });
          } catch (e) {}
        },
        width: 640,
        height: 480,
      });
      camera.start();
      setIsCameraReady(true);
    }

    return () => {
      hands.close();
      camera && camera.stop();
    };
  }, [isRecording, lastSpoken, onPrediction, detectionConfidence]);

  function addLocalExamples() {
    if (samplesRef.current.length === 0) {
      alert('No recorded samples to add.');
      return;
    }
    for (const s of samplesRef.current) {
      const t = tf.tensor(s, [1, s.length]);
      classifier.addExample(t, label);
      t.dispose();
    }
    samplesRef.current = [];
    alert('Added samples to local classifier.');
  }

  function saveGesture() {
    if (samplesRef.current.length === 0) {
      alert('No recorded samples to save.');
      return;
    }
    onSaveGesture(label, [...samplesRef.current]);
    samplesRef.current = [];
  }

  function clearSamples() {
    samplesRef.current = [];
    alert('Cleared local samples.');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full bg-black rounded overflow-hidden relative">
        {!isCameraReady && (
          <div className="absolute inset-0 flex items-center justify-center text-white z-10">
            <div className="text-sm">Initializing Camera...</div>
          </div>
        )}
        <video ref={videoRef} autoPlay playsInline muted className="w-full object-cover" />
        <canvas ref={canvasRef} className="absolute left-0 top-0 pointer-events-none" />
      </div>

      <div className="bg-white rounded shadow p-4 w-full flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <h3 className="font-semibold mb-2">Interpreter</h3>
          
          <div className="mb-3 p-2 bg-blue-50 rounded">
            <label className="block text-sm font-medium mb-2">Detection Confidence</label>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={detectionConfidence}
              onChange={(e) => setDetectionConfidence(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-600 mt-1">
              {(detectionConfidence * 100).toFixed(0)}% (Higher = More Accurate but Fewer Detections)
            </div>
          </div>

          <label className="block text-sm mb-1">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="border p-2 rounded w-full mb-3"
            placeholder="gesture label (e.g. hello)"
          />

          <div className="flex gap-2 mb-3">
            <button
              onMouseDown={() => setIsRecording(true)}
              onMouseUp={() => setIsRecording(false)}
              onTouchStart={() => setIsRecording(true)}
              onTouchEnd={() => setIsRecording(false)}
              className={`flex-1 py-2 rounded ${isRecording ? 'bg-red-500 text-white' : 'bg-gray-100'}`}
            >
              {isRecording ? 'Recording... (release to stop)' : 'Hold to record'}
            </button>

            <button onClick={addLocalExamples} className="py-2 px-3 rounded bg-indigo-600 text-white">
              Add to classifier
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={saveGesture} className="py-2 rounded bg-green-600 text-white flex-1">
              Save (local)
            </button>
            <button onClick={clearSamples} className="py-2 rounded bg-gray-100 text-gray-700">
              Clear
            </button>
          </div>
        </div>

        <div className="w-44">
          <div className="text-sm text-gray-500 mb-1">Predicted</div>
          <div className="text-2xl font-bold text-blue-600 mb-3">{prediction}</div>

          <div className="text-xs text-gray-500">Quick actions</div>
          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={() => {
                if (prediction && prediction !== '—') {
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.speak(new SpeechSynthesisUtterance(prediction));
                } else alert('No prediction to speak');
              }}
              className="py-2 rounded bg-blue-600 text-white"
            >
              Play speech
            </button>

            <button
              onClick={() => {
                addLocalExamples();
              }}
              className="py-2 rounded bg-gray-100"
            >
              Add current samples
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
