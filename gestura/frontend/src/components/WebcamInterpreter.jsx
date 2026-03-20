import { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import * as tf from '@tensorflow/tfjs';
import * as knnClassifier from '@tensorflow-models/knn-classifier';

const classifier = knnClassifier.create();

export default function WebcamInterpreter(props) {
  const { onSaveGesture, onPrediction } = props;
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const samplesRef = useRef([]);
  const [label, setLabel] = useState('hello');
  const [isRecording, setIsRecording] = useState(false);
  const [prediction, setPrediction] = useState('—');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [lastSpoken, setLastSpoken] = useState(0);

  function landmarksToArray(landmarks) {
    if (!landmarks) return null;
    const arr = [];
    for (const lm of landmarks) arr.push(lm.x, lm.y, lm.z ?? 0);
    return arr;
  }

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
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
        const lm = results.multiHandLandmarks[0];
        ctx.fillStyle = 'rgba(0,150,130,0.95)';
        for (const p of lm) {
          ctx.beginPath();
          ctx.arc(p.x * ctx.canvas.width, p.y * ctx.canvas.height, 6, 0, 2 * Math.PI);
          ctx.fill();
        }

        const arr = landmarksToArray(lm);
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
  }, [isRecording, lastSpoken, onPrediction]);

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
