// src/pages/InterpreterPage.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import * as tf from "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import { normalizeLandmarks, FULL_LABEL_SET } from "../lib/normalizeLandmarks";
import API from "../services/api";
import { getTokenPayload } from "../lib/auth";
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:3000";

let globalVision = null;
let globalHandLandmarker = null;
let globalHandInitPromise = null;

const NO_DETECT_SPEAK_MS = 850; // faster phrase speak after ~0.85s of no hand
const STABLE_MS_PER_LETTER = 1500; // confirm after 1.5s of stable hold
const MIN_HAND_SCORE = 0.35;  // Reduced for better palm detection
const MIN_HAND_SPAN = 0.09;   // Reduced for better palm detection
const MIN_HAND_AREA = 0.009;  // Reduced for better palm detection
const PREDICT_INTERVAL_MS = 900;
const PREDICT_INTERVAL_STABLE_MS = 900;
const PREDICT_BACKOFF_MS = 2500;
const PREDICT_BACKOFF_MAX_MS = 8000;
const USE_TF_MODEL = false;
const MODEL_HISTORY_WINDOW_MS = 3000;
const MODEL_MIN_HITS = 2;
const MODEL_MIN_HITS_STRICT = 2;
const MODEL_MIN_HIT_RATIO = 0.6;
const MODEL_MIN_HIT_RATIO_STRICT = 0.65;
const MODEL_MIN_CONF = 0.78;
const MODEL_MIN_MARGIN = 0.1;
const MODEL_MIN_CONF_STRICT = 0.84;
const MODEL_MIN_MARGIN_STRICT = 0.08;
const MODEL_STORE_MIN_CONF = 0.65;
const MODEL_STORE_MIN_MARGIN = 0.05;
const MODEL_INPUT_FRAMES = 3;
const MODEL_HISTORY_MIN_INTERVAL_MS = 350;
const SPACE_CONFIRM_MS = 1500;
const CONFIRM_COOLDOWN_MS = 900;
const REPEAT_SAME_LETTER_GAP_MS = 3500;
const STABLE_PREDICT_PAUSE_MS = 3500;
const POSE_STABLE_HOLD_MS = 450;
const STABLE_LABEL_HOLD_MS = 1500;
const MIN_POSE_DELTA = 0.03;
const BACKEND_POSE_CHANGE_MIN = 0.02;
const MIN_NORM_INTERVAL_MS = 150;
const BACKEND_MIN_STABILITY = 0.3;  // Reduced for better palm tracking
const BACKEND_MIN_PRESENCE = 0.2;   // Reduced for better palm detection
const MIRROR_LEFT_HAND = true;
const DYNAMIC_LABELS = new Set(["J", "Z"]);
const NON_LETTER_LABELS = new Set(["del", "nothing"]);
const STATIC_LABEL_SET = FULL_LABEL_SET.filter(
  (label) => !DYNAMIC_LABELS.has(label) && !NON_LETTER_LABELS.has(label)
);
const STRICT_LABELS = new Set(["P", "Q"]);
const AMBIGUOUS_A_LABELS = new Set(["R", "Q", "S", "E", "T", "M", "N"]);
const HIGH_CONF_OVERRIDE_LABELS = new Set(["C", "O", "M", "N", "S", "T", "U", "X", "R"]);
const HIGH_CONF_OVERRIDE_CONF = 0.87;
const HIGH_CONF_OVERRIDE_MARGIN = 0.04;
const HIGH_CONF_OVERRIDE_STABILITY = 0.2;
const HOLD_MS_BY_LABEL = {
  A: 1700,
  C: 900,
  E: 1700,
  L: 900,
  O: 800,
  S: 750,
  T: 750,
  M: 750,
  N: 800,
  R: 1000,
  Q: 2000,
  K: 2000,
  X: 1400,
  D: 1800,
  F: 1800,
  G: 1600,
  H: 1600,
  P: 1900,
  Y: 1500,
  U: 900,
  V: 1600,
  W: 1700,
  J: 1200,  // Dynamic motion gesture
  Z: 1200,  // Dynamic motion gesture
};
const CONF_MIN_BY_LABEL = {
  A: 0.8,
  C: 0.78,
  E: 0.8,
  L: 0.74,
  O: 0.72,
  S: 0.65,
  T: 0.65,
  M: 0.7,
  N: 0.65,
  R: 0.76,
  Q: 0.88,
  K: 0.88,
  X: 0.88,
  D: 0.86,
  F: 0.84,
  G: 0.8,
  H: 0.8,
  P: 0.84,
  Y: 0.8,
  U: 0.76,
  V: 0.8,
  W: 0.82,
  J: 0.9,   // Motion-based detection
  Z: 0.9,   // Motion-based detection
};
const MARGIN_MIN_BY_LABEL = {
  A: 0.12,
  C: 0.06,
  E: 0.12,
  L: 0.06,
  O: 0.04,
  S: 0.03,
  T: 0.03,
  M: 0.04,
  N: 0.03,
  R: 0.06,
  Q: 0.2,
  K: 0.2,
  X: 0.12,
  D: 0.18,
  F: 0.14,
  G: 0.1,
  H: 0.1,
  P: 0.16,
  Y: 0.12,
  U: 0.06,
  V: 0.12,
  W: 0.14,
  J: 0.25,  // Motion-based detection
  Z: 0.25,  // Motion-based detection
};
const BUCKET_LABELS = {
  fist: new Set(["A", "E", "S", "T", "M", "N"]),
  circle: new Set(["O", "F"]),
  "pinky-only": new Set(["I"]),
  "thumb-pinky": new Set(["Y"]),
  "index-thumb": new Set(["L", "Q", "G"]),
  "index-only": new Set(["D", "X"]),
  two: new Set(["U", "V", "R", "K", "P", "H"]),
  three: new Set(["W"]),
  four: new Set(["B", "W"]),
};
const ROTATION_SENSITIVE_LABELS = new Set(["C", "O", "P", "Q", "U", "V", "W", "R", "X", "Y", "G", "H"]);

function resetSpeechState(
  opts = {
    setLetterSequence: null,
    setConfirmedLetter: null,
    lastSpokenRef: null,
    candidateRef: null,
    frameHistory: null,
    labelHistory: null,
    noDetectionTimeout: null,
    skipSpeakRef: null,
    speakingRef: null,
    letterSequenceRef: null,
    lastAutoSpokenPhraseRef: null,
    pendingAutoSpeakRef: null,
  }
) {
  opts.setLetterSequence?.([]);
  opts.setConfirmedLetter?.("");
  if (opts.lastSpokenRef) opts.lastSpokenRef.current = "";
  if (opts.candidateRef) opts.candidateRef.current = { letter: "", startedAt: 0, lastSeenAt: 0 };
  if (opts.frameHistory) opts.frameHistory.current = [];
  if (opts.labelHistory) opts.labelHistory.current = [];
  if (opts.skipSpeakRef) opts.skipSpeakRef.current = true;
  if (opts.speakingRef) opts.speakingRef.current = false;
  if (opts.letterSequenceRef) opts.letterSequenceRef.current = [];
  if (opts.lastAutoSpokenPhraseRef) opts.lastAutoSpokenPhraseRef.current = "";
  if (opts.pendingAutoSpeakRef) opts.pendingAutoSpeakRef.current = false;
  if (opts.noDetectionTimeout?.current) {
    clearTimeout(opts.noDetectionTimeout.current);
    opts.noDetectionTimeout.current = null;
  }
  if (typeof window !== "undefined") {
    window.speechSynthesis?.cancel();
  }
}

async function getHandLandmarker() {
  if (globalHandLandmarker) return globalHandLandmarker;
  if (globalHandInitPromise) return globalHandInitPromise;

  globalHandInitPromise = (async () => {
    // small safety reset
    if (typeof window !== "undefined" && window.Module) {
      try {
        delete window.Module;
      } catch {
        window.Module = undefined;
      }
    }

    const vision =
      globalVision ||
      (await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      ));
    globalVision = vision;

      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          // make sure this file exists under public/models
          modelAssetPath: "/models/hand_landmarker.task",
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.55,  // Reduced for better palm detection sensitivity
        minHandPresenceConfidence: 0.55,   // Reduced for better palm detection sensitivity
        minTrackingConfidence: 0.65,       // Slightly reduced for stable tracking
      });

    globalHandLandmarker = handLandmarker;
    console.log("Mediapipe HandLandmarker loaded.");
    return handLandmarker;
  })();

  try {
    return await globalHandInitPromise;
  } catch (err) {
    globalHandInitPromise = null;
    throw err;
  }
}

export default function InterpreterPage() {
  const navigate = useNavigate();

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [matchStatus, setMatchStatus] = useState("Live detection");
  const [showInfo, setShowInfo] = useState(false);
  const [localLabel, setLocalLabel] = useState("Waiting for gesture");
  const [confirmedLetter, setConfirmedLetter] = useState("");
  const [remoteLabel] = useState("Waiting for partner...");
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [letterSequence, setLetterSequence] = useState([]);

  const [autoSpeak, setAutoSpeak] = useState(true);
  const showLandmarks = true;
  const autoSpeakRef = useRef(true);
  const [tfModel, setTfModel] = useState(null);
  const [tfReady, setTfReady] = useState(false);
  const lastBackendPredictRef = useRef({
    ts: 0,
    pending: false,
    controller: null,
    errorCount: 0,
    nextTs: 0,
  });

  const allowedLetters = useRef(new Set(STATIC_LABEL_SET));
  const confirmLockRef = useRef("");
  const lastConfirmRef = useRef({ letter: "", ts: 0 });

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomJoined, setRoomJoined] = useState(false);
  const skipSpeakRef = useRef(false);
  const speakingRef = useRef(false);
  const [copyMsg, setCopyMsg] = useState("");

  // DOM refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const canvasRef = useRef(null);

  // detection refs
  const handLandmarkerRef = useRef(null);
  const detectionRafRef = useRef(null);
  const isDetectingRef = useRef(false);
  const isMountedRef = useRef(false);

  // smoothing + history
  const frameHistory = useRef([]);
  const labelHistory = useRef([]);
  const lastSpokenRef = useRef("");
  const sessionLogRef = useRef([]);
  const remoteCandidateRef = useRef({ letter: "", startedAt: 0, lastSeenAt: 0 });

  const candidateRef = useRef({
    letter: "",
    startedAt: 0,
    lastSeenAt: 0,
  });
  const lastAutoSpeakTsRef = useRef(0);
  const lastSpokenLetterRef = useRef("");
  const letterSequenceRef = useRef([]);
  const lastAutoSpokenPhraseRef = useRef("");
  const pendingAutoSpeakRef = useRef(false);
  const lastHandSeenRef = useRef(0);

  const noDetectionTimeout = useRef(null);
  const motionHistoryRef = useRef([]);  // Track hand position over time for J and Z detection
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const roomRef = useRef("");
  const lastLiveSendRef = useRef({ label: "", ts: 0 });
  const lastConfirmedSendRef = useRef({ letter: "", ts: 0 });
  const lastLettersSendRef = useRef({ phrase: "", ts: 0 });
  const [remoteActive, setRemoteActive] = useState(false);
  const [remoteLiveLabel, setRemoteLiveLabel] = useState("Waiting for partner...");
  const [remoteConfirmedLetter, setRemoteConfirmedLetter] = useState("");
  const [remoteLetters, setRemoteLetters] = useState([]);
  const remoteLetterSeqRef = useRef([]);
  const [lastSpokenPhrase, setLastSpokenPhrase] = useState("");
  const [remoteAutoSpeak, setRemoteAutoSpeak] = useState(true);
  const remotePhrase = remoteLetters.join("");
  const modelPredRef = useRef({ label: "", conf: 0, ts: 0 });
  const modelHistoryRef = useRef([]);
  const lastGoodHandsRef = useRef({ hands: null, ts: 0 });
  const smoothedHandsRef = useRef(null);
  const lastHistoryPushRef = useRef(0);
  const normHistoryRef = useRef([]);
  const lastNormVecRef = useRef(null);
  const lastHandMetaRef = useRef({ handedness: "", score: 0, confidence: 0 });
  const lastNormVecTsRef = useRef(0);
  const lastStableLabelRef = useRef({ label: "", ts: 0 });
  const lastPoseVecRef = useRef(null);
  const poseStableSinceRef = useRef(0);
  const lastBackendVecRef = useRef(null);
  const userIdRef = useRef(null);
  const lastTelemetryRef = useRef({ letter: "", ts: 0 });

  // ---------------- SPEECH ----------------
  useEffect(() => {
    autoSpeakRef.current = autoSpeak;

    if (!autoSpeak && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (!autoSpeak && noDetectionTimeout.current) {
      clearTimeout(noDetectionTimeout.current);
      noDetectionTimeout.current = null;
    }
  }, [autoSpeak]);

  useEffect(() => {
    userIdRef.current = getTokenPayload()?.id || null;

    function handleVisibility() {
      if (document.hidden) {
        // Prevent background tab auto-speak; clear timers and queues
        skipSpeakRef.current = true;
        if (noDetectionTimeout.current) {
          clearTimeout(noDetectionTimeout.current);
          noDetectionTimeout.current = null;
        }
        try {
          window.speechSynthesis?.cancel();
        } catch {
          /* ignore */
        }
        speakingRef.current = false;
        pendingAutoSpeakRef.current = false;
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    letterSequenceRef.current = letterSequence;
    if (letterSequence.length) {
      pendingAutoSpeakRef.current = true;
    } else {
      pendingAutoSpeakRef.current = false;
      lastAutoSpokenPhraseRef.current = "";
    }
  }, [letterSequence]);

  // Optional TF.js model loader (expects model at /models/tfjs_model/model.json)
  useEffect(() => {
    let cancelled = false;
    async function loadModel() {
      try {
        await tf.setBackend("webgl");
        await tf.ready();
        const modelUrl = "/models/tfjs_model/model.json";
        const m = await tf.loadLayersModel(modelUrl);
        if (!cancelled) {
          setTfModel(m);
          setTfReady(true);
          console.log("TF.js ASL model loaded");
        }
      } catch (err) {
        // If TF.js model is missing, we'll try backend /api/predict instead
        if (!cancelled) setTfReady(false);
      }
    }
    loadModel();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const phrase = letterSequence.join("");
    const now = Date.now();
    if (
      phrase &&
      (phrase !== lastLettersSendRef.current.phrase ||
        now - lastLettersSendRef.current.ts > 500)
    ) {
      lastLettersSendRef.current = { phrase, ts: now };
      sendRoomPayload({ type: "letters", letters: letterSequence });
    }
    if (!phrase && lastLettersSendRef.current.phrase) {
      lastLettersSendRef.current = { phrase: "", ts: now };
      sendRoomPayload({ type: "clear-letters" });
    }
  }, [letterSequence]);

  function sendRoomPayload(payload) {
    const room = roomRef.current || roomCode.trim();
    if (!room || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    try {
      socketRef.current.send(JSON.stringify({ ...payload, room }));
    } catch (err) {
      console.error("WS send failed", err);
    }
  }

  // Auto-speak remote phrase when new letters arrive and remote is active
  useEffect(() => {
    if (!remoteActive || !remoteAutoSpeak) return;
    if (!remotePhrase) return;
    if (remotePhrase === lastSpokenPhrase) return;
    speakLettersThenPhrase(remoteLetters, true);
    setLastSpokenPhrase(remotePhrase);
  }, [remoteLetters, remoteActive, remotePhrase, lastSpokenPhrase, remoteAutoSpeak]);

  // If local stream becomes available after joining, add tracks to peer
  useEffect(() => {
    const stream = localVideoRef.current?.srcObject;
    if (stream && peerRef.current) {
      const senders = peerRef.current.getSenders();
      stream.getTracks().forEach((track) => {
        const already = senders.find((s) => s.track && s.track.id === track.id);
        if (!already) {
          peerRef.current.addTrack(track, stream);
        }
      });
      // renegotiate if in a room
      if (roomRef.current || roomCode.trim()) {
        createAndSendOffer().catch(() => {/* ignore */});
      }
    }
  }, [isCameraOn]);

  function speak(text, force = false) {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    if (!force && !autoSpeakRef.current) return;

    const cleaned = String(text || "").trim();
    if (!cleaned) return;
    if (!force && lastSpokenRef.current === cleaned) return;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(cleaned);
      utter.lang = "en-US";
      utter.rate = 1;
      utter.pitch = 1;
      window.speechSynthesis.speak(utter);
      lastSpokenRef.current = cleaned;
    } catch (err) {
      console.error("Speech synthesis error:", err);
    }
  }

  function speakLettersThenPhrase(lettersArr, force = false) {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    if (!force && !autoSpeakRef.current) return;
    const letters = (lettersArr || []).join(" ").trim();
    const phrase = (lettersArr || []).join("").trim();
    if (!letters && !phrase) return;
    if (!force && phrase && phrase === lastSpokenRef.current) return;
    if (!force && phrase && phrase === lastSpokenPhrase) return;
    if (speakingRef.current) {
      window.speechSynthesis.cancel();
      speakingRef.current = false;
    }
    try {
      // Cancel any ongoing speech to avoid loops
      window.speechSynthesis.cancel();
      speakingRef.current = true;
      const parts = [];
      if (letters) parts.push(letters);
      if (phrase) parts.push(phrase);
      let idx = 0;
      const playNext = () => {
        if (idx >= parts.length) {
          if (phrase) lastSpokenRef.current = phrase;
          speakingRef.current = false;
          return;
        }
        const utter = new SpeechSynthesisUtterance(parts[idx]);
        utter.lang = "en-US";
        utter.rate = 1;
        utter.pitch = 1;
        utter.onend = () => {
          idx += 1;
          playNext();
        };
        utter.onerror = () => {
          speakingRef.current = false;
        };
        // Small async to avoid blocked queues
        setTimeout(() => {
          try {
            window.speechSynthesis.speak(utter);
          } catch (err) {
            console.error("Speech speak error:", err);
            speakingRef.current = false;
          }
        }, 0);
      };
      playNext();
      if (phrase) {
        lastAutoSpeakTsRef.current = Date.now();
        setLastSpokenPhrase(phrase);
      }
    } catch (err) {
      console.error("Speech sequence error:", err);
      speakingRef.current = false;
    }
  }

  function autoSpeakLastPhrase() {
    const phrase = letterSequence.join("");
    if (phrase) speak(phrase, true);
  }

  // Add space to letter sequence
  function addSpace() {
    if (letterSequence.length === 0 || letterSequence[letterSequence.length - 1] !== "") {
      const newSequence = [...letterSequence, ""];
      setLetterSequence(newSequence);
      letterSequenceRef.current = newSequence;
    }
  }

  // Handle spacebar press for adding spaces
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && isCameraOn && e.target === document.body) {
        e.preventDefault();
        addSpace();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [letterSequence, isCameraOn]);

  // ---------------- CAMERA ----------------
  async function startCamera() {
    if (isCameraOn) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 960 },
          height: { ideal: 540 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });

      const video = localVideoRef.current;
      if (!video) return;

      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
      };

      setIsCameraOn(true);
      setMatchStatus("Live detection (camera running)");

      const lm = await getHandLandmarker();
      handLandmarkerRef.current = lm;
      startDetectionLoop();
    } catch (err) {
      console.error(err);
      setLoadError("Camera permission denied or not available.");
    }
  }

  function stopCamera() {
    const video = localVideoRef.current;
    if (video?.srcObject) {
      const tracks = video.srcObject.getTracks ? video.srcObject.getTracks() : [];
      tracks.forEach((t) => t.stop());
      video.srcObject = null;
    }

    setIsCameraOn(false);
    setMatchStatus("Live detection");

    if (detectionRafRef.current != null) {
      cancelAnimationFrame(detectionRafRef.current);
      detectionRafRef.current = null;
    }
    isDetectingRef.current = false;
    if (noDetectionTimeout.current) clearTimeout(noDetectionTimeout.current);

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    setLocalLabel("Waiting for gesture");
    setDetectionConfidence(0);
    setConfirmedLetter("");
    frameHistory.current = [];
    labelHistory.current = [];
    candidateRef.current = { letter: "", startedAt: 0, lastSeenAt: 0 };

    // Remove tracks from peer connection
    if (peerRef.current) {
      peerRef.current.getSenders().forEach((s) => {
        try {
          peerRef.current.removeTrack(s);
        } catch {
          /* ignore */
        }
      });
    }
  }

  // ---------------- DETECTION LOOP ----------------
  function startDetectionLoop() {
    if (detectionRafRef.current != null) cancelAnimationFrame(detectionRafRef.current);

    const loop = () => {
      if (!isMountedRef.current) return;

      const video = localVideoRef.current;
      const lm = handLandmarkerRef.current;
      const hasLocalStream = !!video?.srcObject;

      if (!video || !lm) {
        detectionRafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (hasLocalStream && (!video.videoWidth || !video.videoHeight)) {
        detectionRafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (isDetectingRef.current) {
        detectionRafRef.current = requestAnimationFrame(loop);
        return;
      }

      isDetectingRef.current = true;
      const now = performance.now();
      let result;

      try {
        if (hasLocalStream) {
          result = lm.detectForVideo(video, now);
        }
      } catch (err) {
        console.warn("detectForVideo error:", err);
      } finally {
        handleHandResult(result, now);
        // Remote interpret if stream active
        if (remoteActive && remoteVideoRef.current && lm) {
          try {
            const remoteResult = lm.detectForVideo(remoteVideoRef.current, now);
            handleRemoteInterpret(remoteResult?.landmarks || []);
          } catch (err) {
            // ignore remote detection errors
          }
        }
        isDetectingRef.current = false;
        detectionRafRef.current = requestAnimationFrame(loop);
      }
    };

    detectionRafRef.current = requestAnimationFrame(loop);
  }

  // ---------------- HELPERS ----------------
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  function getDistance(a, b) {
    if (!a || !b) return 0;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  function getAngle(a, b, c) {
    if (!a || !b || !c) return 0;
    const ab = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
    const cb = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
    const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
    const mag = Math.hypot(ab.x, ab.y, ab.z) * Math.hypot(cb.x, cb.y, cb.z);
    if (!mag) return 0;
    const cos = Math.min(1, Math.max(-1, dot / mag));
    return Math.acos(cos);
  }

  function computeBaseScore(result) {
    const handedness = result?.handednesses || result?.handedness || [];
    if (!handedness.length) return 0;

    const scores = handedness
      .map((h) => (Array.isArray(h) ? h[0]?.score : h?.score))
      .filter((n) => typeof n === "number");

    if (!scores.length) return 0;
    return clamp01(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  function getHandBounds(hand) {
    if (!hand || hand.length < 21) return null;
    const xs = hand.map((p) => p.x);
    const ys = hand.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = maxX - minX;
    const h = maxY - minY;
    const area = w * h;
    return { w, h, area };
  }

  function getHandPresence(hand, handednesses) {
    const bounds = getHandBounds(hand);
    if (!bounds) return { ok: false, score: 0, rawScore: null };
    const rawScore =
      (Array.isArray(handednesses?.[0]) ? handednesses?.[0]?.[0]?.score : handednesses?.[0]?.score) ??
      null;
    const sizeOk =
      bounds.w >= MIN_HAND_SPAN && bounds.h >= MIN_HAND_SPAN && bounds.area >= MIN_HAND_AREA;
    const scoreOk = rawScore == null ? true : rawScore >= MIN_HAND_SCORE;
    const sizeScore = clamp01(bounds.area / Math.max(MIN_HAND_AREA, 1e-6));
    const confScore = rawScore == null ? 1 : Math.max(0.4, rawScore);
    return { ok: sizeOk && scoreOk, score: clamp01(sizeScore * confScore), rawScore };
  }

  function validatePalmLandmarks(hand) {
    // Validate palm landmark quality for accurate detection
    if (!hand || hand.length !== 21) return { valid: false, quality: 0 };
    
    // Check that landmarks form a reasonable hand structure
    const wrist = hand[0];     // Wrist
    const indexMcp = hand[5];  // Index MCP
    const middleMcp = hand[9]; // Middle MCP
    const pinkyMcp = hand[17]; // Pinky MCP
    
    if (!wrist || !indexMcp || !middleMcp || !pinkyMcp) {
      return { valid: false, quality: 0 };
    }
    
    // Verify reasonable distances between key palm points
    const wristToIndex = getDistance(wrist, indexMcp);
    const wristToMiddle = getDistance(wrist, middleMcp);
    const wristToPinky = getDistance(wrist, pinkyMcp);
    
    // Landmarks should form a spread hand pattern (relaxed thresholds)
    const minDistance = 0.01;   // Very low minimum for diverse hand positions
    const maxDistance = 1.5;    // High maximum for all hand sizes
    
    const distancesValid = 
      wristToIndex >= minDistance && wristToIndex <= maxDistance &&
      wristToMiddle >= minDistance && wristToMiddle <= maxDistance &&
      wristToPinky >= minDistance && wristToPinky <= maxDistance;
    
    // Calculate palm quality score based on landmark spread (very lenient)
    const avgDistance = (wristToIndex + wristToMiddle + wristToPinky) / 3;
    const optimalDistance = 0.1;
    const quality = clamp01(1 - Math.abs(avgDistance - optimalDistance) / 1.0);
    
    return { 
      valid: distancesValid && quality > 0.05,  // Very lenient threshold
      quality: quality
    };
  }

  function isRotationHeavy(hand) {
    if (!hand || hand.length < 21) return false;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    hand.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      minZ = Math.min(minZ, p.z || 0);
      maxZ = Math.max(maxZ, p.z || 0);
    });
    const spanXY = Math.hypot(maxX - minX, maxY - minY);
    const spanZ = maxZ - minZ;
    return spanZ > spanXY * 0.4;
  }

  function computeStabilityScore(landmarks) {
    if (!landmarks || landmarks.length === 0) {
      frameHistory.current = [];
      return 0;
    }

    const snapshot = landmarks.map((hand) =>
      hand.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 }))
    );

    frameHistory.current.push(snapshot);
    if (frameHistory.current.length > 8) frameHistory.current.shift();

    if (frameHistory.current.length < 2) return 0.5;

    const prev = frameHistory.current[frameHistory.current.length - 2];
    const handCount = Math.min(prev.length, snapshot.length);
    if (handCount === 0) return 0;

    let movement = 0;
    let count = 0;

    for (let i = 0; i < handCount; i++) {
      const prevHand = prev[i] || [];
      const currHand = snapshot[i] || [];
      const pointCount = Math.min(prevHand.length, currHand.length);
      for (let j = 0; j < pointCount; j++) {
        const a = prevHand[j];
        const b = currHand[j];
        if (!a || !b) continue;
        movement += getDistance(a, b);
        count++;
      }
    }

    const avgMove = movement / Math.max(count, 1);
    return clamp01(1 - avgMove / 0.06);
  }

  function smoothHands(hands, allowSmooth = true) {
    if (!hands || !hands.length) {
      smoothedHandsRef.current = null;
      return hands;
    }
    if (!allowSmooth) {
      smoothedHandsRef.current = hands;
      return hands;
    }
    const prev = smoothedHandsRef.current;
    if (!prev || !prev.length) {
      smoothedHandsRef.current = hands;
      return hands;
    }
    let totalMove = 0;
    let count = 0;
    hands.forEach((hand, handIndex) => {
      const prevHand = prev[handIndex];
      if (!prevHand || prevHand.length !== hand.length) return;
      hand.forEach((p, idx) => {
        const q = prevHand[idx];
        if (!q) return;
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        totalMove += Math.hypot(dx, dy);
        count += 1;
      });
    });
    const avgMove = count ? totalMove / count : 0;
    // More responsive to hand movement for better palm tracking
    if (avgMove > 0.08) {
      smoothedHandsRef.current = hands;
      return hands;
    }
    // Lighter smoothing to maintain palm accuracy
    const alpha = 0.5;
    const smoothed = hands.map((hand, handIndex) => {
      const prevHand = prev[handIndex];
      if (!prevHand || prevHand.length !== hand.length) return hand;
      return hand.map((p, idx) => {
        const q = prevHand[idx];
        if (!q) return p;
        const pz = p.z || 0;
        const qz = q.z || 0;
        return {
          x: q.x * alpha + p.x * (1 - alpha),
          y: q.y * alpha + p.y * (1 - alpha),
          z: qz * alpha + pz * (1 - alpha),
        };
      });
    });
    smoothedHandsRef.current = smoothed;
    return smoothed;
  }

  function stabilizeHands(hands, ok) {
    const now = Date.now();
    if (!hands || !hands.length) {
      lastGoodHandsRef.current = { hands: null, ts: 0 };
      return [];
    }
    if (ok && hands.length) {
      lastGoodHandsRef.current = { hands, ts: now };
      return hands;
    }
    const last = lastGoodHandsRef.current;
    if (last.hands && now - last.ts < 200) {
      return last.hands;
    }
    return hands;
  }

  function isFingerExtended(hand, tipIndex, pipIndex, mcpIndex) {
    const t = hand[tipIndex];
    const p = hand[pipIndex];
    const m = hand[mcpIndex];
    if (!t || !p || !m) return false;

    const wrist = hand[0];
    const angle = getAngle(m, p, t);
    const distTP = getDistance(t, m);
    const distBone = getDistance(p, m);
    const straight = angle > 2.95;
    const tipFar = distTP > distBone * 1.25;
    const wristFar = wrist ? getDistance(t, wrist) > getDistance(p, wrist) * 1.08 : true;
    return straight && tipFar && wristFar;
  }

  function isFingerExtendedLoose(hand, tipIndex, pipIndex, mcpIndex) {
    const t = hand[tipIndex];
    const p = hand[pipIndex];
    const m = hand[mcpIndex];
    if (!t || !p || !m) return false;
    const wrist = hand[0];
    const angle = getAngle(m, p, t);
    const distTP = getDistance(t, m);
    const distBone = getDistance(p, m);
    const straight = angle > 2.75;
    const tipFar = distTP > distBone * 1.12;
    const wristFar = wrist ? getDistance(t, wrist) > getDistance(p, wrist) * 1.02 : true;
    return straight && tipFar && wristFar;
  }

  function isFingerCurled(hand, tipIndex, pipIndex, mcpIndex) {
    const t = hand[tipIndex];
    const p = hand[pipIndex];
    const m = hand[mcpIndex];
    if (!t || !p || !m) return false;

    const angle = getAngle(m, p, t);
    const curlDist = getDistance(t, m);
    const boneDist = getDistance(p, m);
    const bent = angle < 2.35;
    const tucked = curlDist < boneDist * 0.9;
    return bent || tucked;
  }

  function isThumbExtended(hand) {
    const wrist = hand[0];
    const tip = hand[4];
    const ip = hand[3];
    const mcp = hand[2];
    if (!wrist || !tip || !ip) return false;

    const angle = mcp ? getAngle(mcp, ip, tip) : 0;
    const tipFar = getDistance(tip, wrist) > getDistance(ip, wrist) * 1.05;
    const side = Math.abs(tip.x - wrist.x) > 0.05;
    return angle > 2.3 && tipFar && side;
  }

  function areFingersTogether(hand, threshold = 0.09) {
    const tips = [8, 12, 16, 20].map((i) => hand[i]).filter(Boolean);
    let total = 0;
    let n = 0;
    for (let i = 0; i < tips.length; i++) {
      for (let j = i + 1; j < tips.length; j++) {
        total += getDistance(tips[i], tips[j]);
        n++;
      }
    }
    return n && total / n < threshold;
  }

  function averageCurl(hand, fingers) {
    let sum = 0;
    let c = 0;
    fingers.forEach((tipIndex) => {
      const tip = hand[tipIndex];
      const pip = hand[tipIndex - 2];
      const mcp = hand[tipIndex - 3];
      if (!tip || !pip || !mcp) return;
      const straight = getDistance(mcp, pip);
      const curled = getDistance(mcp, tip);
      sum += clamp01(1 - curled / straight);
      c++;
    });
    return c ? sum / c : 0;
  }

  function averageVectors(vectors) {
    if (!vectors || !vectors.length) return null;
    const len = vectors[0].length;
    const out = new Array(len).fill(0);
    vectors.forEach((vec) => {
      for (let i = 0; i < len; i++) out[i] += vec[i];
    });
    for (let i = 0; i < len; i++) out[i] /= vectors.length;
    return out;
  }

  function averageAbsDiff(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.abs(a[i] - b[i]);
    }
    return sum / a.length;
  }

  function countThumbTipCloseToFingertips(hand, palmSize, factor = 0.55) {
    if (!hand || hand.length < 21) return 0;
    const thumbTip = hand[4];
    if (!thumbTip) return 0;
    const tips = [hand[8], hand[12], hand[16], hand[20]].filter(Boolean);
    const limit = palmSize * factor;
    let count = 0;
    tips.forEach((tip) => {
      if (getDistance(thumbTip, tip) < limit) count += 1;
    });
    return count;
  }

  function isStrongA(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbTip = hand[4];
    const indexMcp = hand[5];
    const middleMcp = hand[9];
    if (!thumbTip || !indexMcp) return false;
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const ringExt = isFingerExtended(hand, 16, 14, 13);
    const pinkyExt = isFingerExtended(hand, 20, 18, 17);
    const allCurled = !indexExt && !middleExt && !ringExt && !pinkyExt;
    if (!allCurled) return false;
    if (isOishPose(hand)) return false;
    const distSide = getDistance(thumbTip, indexMcp);
    const thumbToMiddle = middleMcp ? getDistance(thumbTip, middleMcp) : distSide * 1.3;
    const thumbCloserToIndex = thumbToMiddle - distSide > palmSize * 0.01;
    const thumbClose = distSide < palmSize * 1.55;
    const curl = averageCurl(hand, [8, 12, 16, 20]);
    if (isStrongE(hand)) return false;
    return thumbClose && thumbCloserToIndex && curl > 0.5;
  }

  function isStrongB(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbTip = hand[4];
    const indexMcp = hand[5];
    const thumbExt = isThumbExtended(hand);
    const indexExt = isFingerExtendedLoose(hand, 8, 6, 5);
    const middleExt = isFingerExtendedLoose(hand, 12, 10, 9);
    const ringExt = isFingerExtendedLoose(hand, 16, 14, 13);
    const pinkyExt = isFingerExtendedLoose(hand, 20, 18, 17);
    const fingersTogether = areFingersTogether(hand, 0.14);
    const curl = averageCurl(hand, [8, 12, 16, 20]);
    const thumbAcross = thumbTip && indexMcp
      ? getDistance(thumbTip, indexMcp) < palmSize * 1.6
      : false;
    return (
      indexExt &&
      middleExt &&
      ringExt &&
      pinkyExt &&
      fingersTogether &&
      (thumbAcross || !thumbExt) &&
      curl < 0.55
    );
  }

  function isStrongF(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleExt = isFingerExtendedLoose(hand, 12, 10, 9);
    const ringExt = isFingerExtendedLoose(hand, 16, 14, 13);
    const pinkyExt = isFingerExtendedLoose(hand, 20, 18, 17);
    const indexExtLoose = isFingerExtendedLoose(hand, 8, 6, 5);
    const indexCurled = isFingerCurled(hand, 8, 6, 5);
    const indexBent = indexCurled || !indexExtLoose;
    const circle =
      thumbTip && indexTip ? getDistance(thumbTip, indexTip) < palmSize * 0.4 : false;
    return circle && indexBent && middleExt && ringExt && pinkyExt;
  }

  function isStrongG(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbExt = isThumbExtended(hand);
    const indexExt = isFingerExtendedLoose(hand, 8, 6, 5);
    const middleCurled = isFingerCurled(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    const pinkyCurled = isFingerCurled(hand, 20, 18, 17);
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const indexMcp = hand[5];
    const indexPip = hand[6];
    const wrist = hand[0];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];
    const horizontal =
      indexTip && indexMcp ? Math.abs(indexTip.y - indexMcp.y) < palmSize * 0.35 : false;
    const sideways =
      indexTip && indexMcp ? Math.abs(indexTip.x - indexMcp.x) > palmSize * 0.35 : false;
    const thumbNear = thumbTip && indexMcp
      ? getDistance(thumbTip, indexMcp) < palmSize * 1.7
      : false;
    const indexAngle = indexTip && indexPip && indexMcp ? getAngle(indexMcp, indexPip, indexTip) : 0;
    const indexStraight = indexAngle > 2.8;
    const tipGap = thumbTip && indexTip ? getDistance(thumbTip, indexTip) : 99;
    const gapOk = tipGap < palmSize * 1.1;
    const indexToWrist = indexTip && wrist ? getDistance(indexTip, wrist) : 0;
    const tuckedAvg =
      middleTip && ringTip && pinkyTip && wrist
        ? (getDistance(middleTip, wrist) + getDistance(ringTip, wrist) + getDistance(pinkyTip, wrist)) / 3
        : 99;
    const tuckedOk = indexToWrist > 0 ? tuckedAvg < indexToWrist * 0.78 : false;
    return (
      thumbExt &&
      indexExt &&
      middleCurled &&
      ringCurled &&
      pinkyCurled &&
      horizontal &&
      sideways &&
      thumbNear &&
      indexStraight &&
      gapOk &&
      tuckedOk
    );
  }

  function isStrongH(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbExt = isThumbExtended(hand);
    const indexExt = isFingerExtendedLoose(hand, 8, 6, 5);
    const middleExt = isFingerExtendedLoose(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    const pinkyCurled = isFingerCurled(hand, 20, 18, 17);
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const indexMcp = hand[5];
    const middleMcp = hand[9];
    const thumbTucked = !thumbExt && thumbTip && indexMcp
      ? getDistance(thumbTip, indexMcp) < palmSize * 1.35
      : !thumbExt;
    const tipsNear = indexTip && middleTip ? getDistance(indexTip, middleTip) < palmSize * 0.35 : false;
    const horizontalIndex =
      indexTip && indexMcp ? Math.abs(indexTip.y - indexMcp.y) < palmSize * 0.35 : false;
    const horizontalMiddle =
      middleTip && middleMcp ? Math.abs(middleTip.y - middleMcp.y) < palmSize * 0.35 : false;
    return (
      indexExt &&
      middleExt &&
      ringCurled &&
      pinkyCurled &&
      thumbTucked &&
      tipsNear &&
      horizontalIndex &&
      horizontalMiddle
    );
  }

  function isGishPose(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbExt = isThumbExtended(hand);
    const indexExt = isFingerExtendedLoose(hand, 8, 6, 5);
    const middleCurled = isFingerCurled(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    const pinkyCurled = isFingerCurled(hand, 20, 18, 17);
    const indexTip = hand[8];
    const indexMcp = hand[5];
    const horizontal =
      indexTip && indexMcp ? Math.abs(indexTip.y - indexMcp.y) < palmSize * 0.45 : false;
    const sideways =
      indexTip && indexMcp ? Math.abs(indexTip.x - indexMcp.x) > palmSize * 0.25 : false;
    return (
      thumbExt &&
      indexExt &&
      middleCurled &&
      ringCurled &&
      pinkyCurled &&
      (horizontal || sideways)
    );
  }

  function isStrongY(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbExt = isThumbExtended(hand);
    const pinkyExt = isFingerExtended(hand, 20, 18, 17);
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const ringExt = isFingerExtended(hand, 16, 14, 13);
    const indexCurled = isFingerCurled(hand, 8, 6, 5);
    const middleCurled = isFingerCurled(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    if (!thumbExt || !pinkyExt || indexExt || middleExt || ringExt) return false;
    if (!indexCurled || !middleCurled || !ringCurled) return false;
    const thumbTip = hand[4];
    const pinkyTip = hand[20];
    const spread =
      thumbTip && pinkyTip ? getDistance(thumbTip, pinkyTip) > palmSize * 0.75 : true;
    return spread;
  }

  // Detect dynamic J: Index finger pointing + downward curved motion
  function detectJMotion(hand) {
    if (!hand || hand.length < 21) return false;
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const ringExt = isFingerExtended(hand, 16, 14, 13);
    const pinkyExt = isFingerExtended(hand, 20, 18, 17);
    const thumbExt = isThumbExtended(hand);
    
    // J pose: only index extended, others curled
    const jPose = indexExt && !middleExt && !ringExt && !pinkyExt && thumbExt;
    if (!jPose) return false;

    // Check motion: index tip should move downward and curve
    if (motionHistoryRef.current.length < 5) {
      motionHistoryRef.current.push(hand);
      return false;
    }

    const indexTip = hand[8];
    const oldHand = motionHistoryRef.current[0];
    const oldIndexTip = oldHand?.[8];
    
    if (!indexTip || !oldIndexTip) return false;

    // Motion should be downward (y increases)
    const verticalMotion = indexTip.y - oldIndexTip.y;
    const horizontalMotion = Math.abs(indexTip.x - oldIndexTip.x);
    
    // J is downward curve: mostly vertical, small horizontal
    return verticalMotion > 0.05 && horizontalMotion < verticalMotion * 0.5;
  }

  // Detect dynamic Z: Zig-zag motion right-down-left
  function detectZMotion(hand) {
    if (!hand || hand.length < 21) return false;
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const thumbExt = isThumbExtended(hand);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const ringExt = isFingerExtended(hand, 16, 14, 13);
    const pinkyExt = isFingerExtended(hand, 20, 18, 17);
    
    // Z pose: index and middle extended, others curled
    const zPose = indexExt && middleExt && !ringExt && !pinkyExt && !thumbExt;
    if (!zPose) return false;

    // Need at least 8 frames to detect zig-zag pattern
    if (motionHistoryRef.current.length < 8) {
      motionHistoryRef.current.push(hand);
      return false;
    }

    const indexTip = hand[8];
    if (!indexTip) return false;

    // Analyze motion pattern: should have direction changes (zig-zag)
    let directionChanges = 0;
    let prevDx = 0;
    let prevDy = 0;

    for (let i = 1; i < Math.min(motionHistoryRef.current.length, 8); i++) {
      const curr = motionHistoryRef.current[i]?.[8];
      const prev = motionHistoryRef.current[i - 1]?.[8];
      if (!curr || !prev) continue;

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;

      // Check if direction changed (sign flip)
      if ((prevDx > 0 && dx < -0.01) || (prevDx < -0.01 && dx > 0)) {
        directionChanges++;
      }

      prevDx = dx;
      prevDy = dy;
    }

    // Z pattern should have 2+ direction changes
    return directionChanges >= 2;
  }

  function isStrongO(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const indexCurled = isFingerCurled(hand, 8, 6, 5);
    const middleCurled = isFingerCurled(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    const pinkyCurled = isFingerCurled(hand, 20, 18, 17);
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const indexMcp = hand[5];
    const middleMcp = hand[9];
    const ringMcp = hand[13];
    const pinkyMcp = hand[17];
    const pinkyTip = hand[20];
    const tipToMcpAvg =
      indexTip && middleTip && ringTip && pinkyTip && indexMcp && middleMcp && ringMcp && pinkyMcp
        ? (
            getDistance(indexTip, indexMcp) +
            getDistance(middleTip, middleMcp) +
            getDistance(ringTip, ringMcp) +
            getDistance(pinkyTip, pinkyMcp)
          ) / 4
        : 0;
    const tipMcpOk = tipToMcpAvg > palmSize * 0.32;
    const circle =
      thumbTip && indexTip ? getDistance(thumbTip, indexTip) < palmSize * 0.6 : false;
    const thumbToIndexMcp = thumbTip && indexMcp ? getDistance(thumbTip, indexMcp) : 99;
    const tipCloserThanMcp =
      circle && thumbToIndexMcp ? getDistance(thumbTip, indexTip) < thumbToIndexMcp * 0.95 : false;
    const arcWidth = indexTip && pinkyTip ? getDistance(indexTip, pinkyTip) : 0;
    const arcOk = arcWidth > palmSize * 0.2 && arcWidth < palmSize * 1.5;
    const curl = averageCurl(hand, [8, 12, 16, 20]);
    return (
      indexCurled &&
      middleCurled &&
      ringCurled &&
      pinkyCurled &&
      circle &&
      tipCloserThanMcp &&
      curl > 0.42 &&
      curl < 0.88 &&
      arcOk &&
      tipMcpOk
    );
  }

  function isCishPose(hand) {
    if (!hand || hand.length < 21) return false;
    if (isStrongG(hand) || isStrongH(hand)) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const pinkyTip = hand[20];
    if (!thumbTip || !indexTip || !pinkyTip) return false;
    const arcWidth = getDistance(indexTip, pinkyTip);
    const gap = getDistance(thumbTip, indexTip);
    const arcOk = arcWidth > palmSize * 0.8 && arcWidth < palmSize * 2.2;
    const gapOk = gap > palmSize * 0.45 && gap < palmSize * 1.8;
    const indexBent = !isFingerExtendedLoose(hand, 8, 6, 5);
    const middleBent = !isFingerExtendedLoose(hand, 12, 10, 9);
    const curl = averageCurl(hand, [8, 12, 16, 20]);
    return arcOk && gapOk && indexBent && middleBent && curl > 0.18 && curl < 0.88;
  }

  function isOishPose(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];
    const thumbIndexGap = thumbTip && indexTip ? getDistance(thumbTip, indexTip) : 99;
    const indexMcp = hand[5];
    const middleMcp = hand[9];
    const ringMcp = hand[13];
    const pinkyMcp = hand[17];
    if (!thumbTip || !indexTip || !middleTip || !ringTip || !pinkyTip) return false;
    if (thumbIndexGap > palmSize * 0.5) return false;
    const circle = getDistance(thumbTip, indexTip) < palmSize * 0.6;
    const arcWidth = getDistance(indexTip, pinkyTip);
    const arcOk = arcWidth > palmSize * 0.2 && arcWidth < palmSize * 1.6;
    const tipToMcpAvg =
      indexMcp && middleMcp && ringMcp && pinkyMcp
        ? (
            getDistance(indexTip, indexMcp) +
            getDistance(middleTip, middleMcp) +
            getDistance(ringTip, ringMcp) +
            getDistance(pinkyTip, pinkyMcp)
          ) / 4
        : 0;
    const tipMcpOk = tipToMcpAvg > palmSize * 0.3;
    const indexCurled = isFingerCurled(hand, 8, 6, 5);
    const middleCurled = isFingerCurled(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    const pinkyCurled = isFingerCurled(hand, 20, 18, 17);
    const curl = averageCurl(hand, [8, 12, 16, 20]);
    return (
      circle &&
      arcOk &&
      tipMcpOk &&
      indexCurled &&
      middleCurled &&
      ringCurled &&
      pinkyCurled &&
      curl > 0.38 &&
      curl < 0.9
    );
  }

  function isStrongC(hand) {
    if (!hand || hand.length < 21) return false;
    if (isStrongD(hand)) return false;
    if (isStrongG(hand) || isStrongH(hand)) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const pinkyTip = hand[20];
    const arcWidth = indexTip && pinkyTip ? getDistance(indexTip, pinkyTip) : 0;
    const curl = averageCurl(hand, [8, 12, 16, 20]);
    const gap =
      thumbTip && indexTip ? getDistance(thumbTip, indexTip) : palmSize * 0.5;
    const arcOk = arcWidth > palmSize * 0.7 && arcWidth < palmSize * 2.1;
    const gapOk = gap > palmSize * 0.4 && gap < palmSize * 1.6;
    const notTight = gap > palmSize * 0.42;
    const indexBent = !isFingerExtendedLoose(hand, 8, 6, 5);
    const middleBent = !isFingerExtendedLoose(hand, 12, 10, 9);
    const ringBent = !isFingerExtendedLoose(hand, 16, 14, 13);
    const pinkyBent = !isFingerExtendedLoose(hand, 20, 18, 17);
    const bentCount = [indexBent, middleBent, ringBent, pinkyBent].filter(Boolean).length;
    return (
      curl > 0.25 &&
      curl < 0.85 &&
      arcOk &&
      gapOk &&
      notTight &&
      indexBent &&
      middleBent &&
      bentCount >= 3
    );
  }

  function isStrongD(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbTip = hand[4];
    const middleTip = hand[12];
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const middleCurled = isFingerCurled(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    const pinkyCurled = isFingerCurled(hand, 20, 18, 17);
    const thumbNearMiddle =
      thumbTip && middleTip ? getDistance(thumbTip, middleTip) < palmSize * 0.4 : false;
    return indexExt && middleCurled && ringCurled && pinkyCurled && thumbNearMiddle;
  }

  function isStrongE(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbTip = hand[4];
    const indexMcp = hand[5];
    const middleMcp = hand[9];
    const ringMcp = hand[13];
    const pinkyMcp = hand[17];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const ringExt = isFingerExtended(hand, 16, 14, 13);
    const pinkyExt = isFingerExtended(hand, 20, 18, 17);
    const allCurled = !indexExt && !middleExt && !ringExt && !pinkyExt;
    const thumbToIndex = thumbTip && indexMcp ? getDistance(thumbTip, indexMcp) : 99;
    const thumbToMiddle = thumbTip && middleMcp ? getDistance(thumbTip, middleMcp) : 99;
    const thumbToRing = thumbTip && ringMcp ? getDistance(thumbTip, ringMcp) : 99;
    const thumbToPinky = thumbTip && pinkyMcp ? getDistance(thumbTip, pinkyMcp) : 99;
    const thumbToIndexTip = thumbTip && indexTip ? getDistance(thumbTip, indexTip) : 99;
    const thumbToMiddleTip = thumbTip && middleTip ? getDistance(thumbTip, middleTip) : 99;
    const thumbAcross =
      thumbTip && indexMcp
        ? thumbToIndex < palmSize * 1.35 && thumbToMiddle + palmSize * 0.02 < thumbToIndex
        : false;
    const curl = averageCurl(hand, [8, 12, 16, 20]);
    const tipCloseCount = countThumbTipCloseToFingertips(hand, palmSize, 0.6);
    const thumbNearTips = tipCloseCount >= 3;
    return allCurled && thumbAcross && thumbToRing < palmSize * 1.35 && curl > 0.6 && thumbNearTips;
  }

  function isStrongS(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbTip = hand[4];
    const indexMcp = hand[5];
    const middleMcp = hand[9];
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const ringExt = isFingerExtended(hand, 16, 14, 13);
    const pinkyExt = isFingerExtended(hand, 20, 18, 17);
    const allCurled = !indexExt && !middleExt && !ringExt && !pinkyExt;
    const curl = averageCurl(hand, [8, 12, 16, 20]);
    const thumbAcross = thumbTip && indexMcp ? getDistance(thumbTip, indexMcp) < palmSize * 1.45 : false;
    const betweenIndexMiddle =
      thumbTip &&
      indexMcp &&
      middleMcp &&
      thumbTip.x > Math.min(indexMcp.x, middleMcp.x) &&
      thumbTip.x < Math.max(indexMcp.x, middleMcp.x);
    const tipCloseCount = countThumbTipCloseToFingertips(hand, palmSize, 0.6);
    const tipsFar = tipCloseCount <= 1;
    return allCurled && curl > 0.55 && thumbAcross && tipsFar && !betweenIndexMiddle;
  }

  function isStrongK(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const indexMcp = hand[5];
    const middleMcp = hand[9];
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    const pinkyCurled = isFingerCurled(hand, 20, 18, 17);
    const thumbExt = isThumbExtended(hand);
    const thumbBetween =
      thumbTip && indexMcp && middleMcp
        ? thumbTip.x > Math.min(indexMcp.x, middleMcp.x) &&
          thumbTip.x < Math.max(indexMcp.x, middleMcp.x)
        : false;
    const spread =
      indexTip && middleTip ? getDistance(indexTip, middleTip) > palmSize * 0.25 : false;
    return indexExt && middleExt && ringCurled && pinkyCurled && thumbExt && thumbBetween && spread;
  }

  function isStrongR(hand) {
    if (!hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const indexTip = hand[8];
    const middleTip = hand[12];
    const indexMcp = hand[5];
    const middleMcp = hand[9];
    const thumbTip = hand[4];
    const indexExt = isFingerExtendedLoose(hand, 8, 6, 5);
    const middleExt = isFingerExtendedLoose(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    const pinkyCurled = isFingerCurled(hand, 20, 18, 17);
    const tipsNear =
      indexTip && middleTip ? getDistance(indexTip, middleTip) < palmSize * 0.45 : false;
    const sameHeight =
      indexTip && middleTip ? Math.abs(indexTip.y - middleTip.y) < 0.18 : false;
    const crossed =
      indexTip && middleTip && indexMcp && middleMcp
        ? (indexTip.x - middleTip.x) * (indexMcp.x - middleMcp.x) < 0
        : false;
    const thumbTucked =
      thumbTip && indexMcp ? getDistance(thumbTip, indexMcp) < palmSize * 1.6 : false;
    const rotationHeavy = isRotationHeavy(hand);
    return (
      indexExt &&
      middleExt &&
      ringCurled &&
      pinkyCurled &&
      thumbTucked &&
      tipsNear &&
      (crossed || rotationHeavy) &&
      (sameHeight || rotationHeavy)
    );
  }

  function isStrongX(hand) {
    if (!hand || hand.length < 21) return false;
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const indexCurled = isFingerCurled(hand, 8, 6, 5);
    const middleCurled = isFingerCurled(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    const pinkyCurled = isFingerCurled(hand, 20, 18, 17);
    const thumbExt = isThumbExtended(hand);
    const indexTip = hand[8];
    const indexPip = hand[6];
    const indexMcp = hand[5];
    if (!indexTip || !indexPip || !indexMcp) return false;
    const angle = getAngle(indexMcp, indexPip, indexTip);
    const tipDist = getDistance(indexTip, indexMcp);
    const boneDist = getDistance(indexPip, indexMcp);
    const bentHook = angle > 1.6 && angle < 2.4;
    const notFullyCurled = tipDist > boneDist * 0.65 && tipDist < boneDist * 1.25;
    const pointingUp = indexTip.y < indexMcp.y - 0.02;
    return (
      !indexExt &&
      indexCurled &&
      middleCurled &&
      ringCurled &&
      pinkyCurled &&
      !thumbExt &&
      bentHook &&
      notFullyCurled &&
      pointingUp
    );
  }

  function classifyPoseBucket(hand) {
    if (!hand || hand.length < 21) return "unknown";
    const thumbExt = isThumbExtended(hand);
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const ringExt = isFingerExtended(hand, 16, 14, 13);
    const pinkyExt = isFingerExtended(hand, 20, 18, 17);
    const indexExtLoose = isFingerExtendedLoose(hand, 8, 6, 5);
    const middleExtLoose = isFingerExtendedLoose(hand, 12, 10, 9);
    const ringExtLoose = isFingerExtendedLoose(hand, 16, 14, 13);
    const pinkyExtLoose = isFingerExtendedLoose(hand, 20, 18, 17);
    const allCurled = !indexExt && !middleExt && !ringExt && !pinkyExt;
    const curl = averageCurl(hand, [8, 12, 16, 20]);
    const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbTip = hand[4];
    const indexMcp = hand[5];
    const indexTip = hand[8];
    const circle =
      thumbTip && indexTip ? getDistance(thumbTip, indexTip) < palmSize * 0.45 : false;
    const thumbNearPalm =
      thumbTip && indexMcp ? getDistance(thumbTip, indexMcp) < palmSize * 1.7 : false;
    const fistLike = curl > 0.6 && extendedCount <= 1 && (!thumbExt || thumbNearPalm);

    if (allCurled && curl > 0.6 && (!thumbExt || thumbNearPalm)) return "fist";
    if (fistLike) return "fist";
    if (isStrongO(hand) || circle) return "circle";
    if (isStrongB(hand)) return "four";
    if (pinkyExtLoose && !indexExtLoose && !middleExtLoose && !ringExtLoose && !thumbExt) {
      return "pinky-only";
    }
    if (thumbExt && pinkyExtLoose && !indexExtLoose && !middleExtLoose && !ringExtLoose) {
      return "thumb-pinky";
    }
    if (indexExtLoose && thumbExt && !middleExtLoose && !ringExtLoose && !pinkyExtLoose) {
      return "index-thumb";
    }
    if (indexExtLoose && !middleExtLoose && !ringExtLoose && !pinkyExtLoose) return "index-only";
    if (indexExtLoose && middleExtLoose && !ringExtLoose && !pinkyExtLoose) return "two";
    if (indexExtLoose && middleExtLoose && ringExtLoose && !pinkyExtLoose) return "three";
    if (indexExtLoose && middleExtLoose && ringExtLoose && pinkyExtLoose) return "four";
    return "unknown";
  }

  function isLabelAllowedForBucket(label, bucket) {
    if (!label) return false;
    if (label === "C" || label === "O") return true;
    if (bucket === "fist" && ["A", "E", "S", "T", "M", "N"].includes(label)) return true;
    const allowed = BUCKET_LABELS[bucket];
    if (!allowed) return true;
    return allowed.has(label);
  }

  function getLabelThresholds(label, strictLabel) {
    const conf =
      CONF_MIN_BY_LABEL[label] ??
      (strictLabel ? MODEL_MIN_CONF_STRICT : MODEL_MIN_CONF);
    const margin =
      MARGIN_MIN_BY_LABEL[label] ??
      (strictLabel ? MODEL_MIN_MARGIN_STRICT : MODEL_MIN_MARGIN);
    return { conf, margin };
  }

  function getHoldMs(label) {
    return HOLD_MS_BY_LABEL[label] ?? STABLE_MS_PER_LETTER;
  }

  function classifyFistLetter(hand) {
    if (!hand || hand.length < 21) return "";
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    const thumbTip = hand[4];
    const indexMcp = hand[5];
    const middleMcp = hand[9];
    const ringMcp = hand[13];
    const pinkyMcp = hand[17];
    const thumbExt = isThumbExtended(hand);
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const ringExt = isFingerExtended(hand, 16, 14, 13);
    const pinkyExt = isFingerExtended(hand, 20, 18, 17);
    const indexExtLoose = isFingerExtendedLoose(hand, 8, 6, 5);
    const middleExtLoose = isFingerExtendedLoose(hand, 12, 10, 9);
    const ringExtLoose = isFingerExtendedLoose(hand, 16, 14, 13);
    const pinkyExtLoose = isFingerExtendedLoose(hand, 20, 18, 17);
    const curl = averageCurl(hand, [8, 12, 16, 20]);
    const allCurled = !indexExt && !middleExt && !ringExt && !pinkyExt;
    const fistLike = allCurled && curl > 0.5 && !thumbExt;
    const looseCount = [indexExtLoose, middleExtLoose, ringExtLoose, pinkyExtLoose].filter(Boolean).length;
    const thumbNearPalm =
      thumbTip && indexMcp ? getDistance(thumbTip, indexMcp) < palmSize * 1.55 : false;
    const fistCandidateLoose = curl > 0.42 && looseCount <= 2 && (!thumbExt || thumbNearPalm);
    if ((!fistLike && !fistCandidateLoose) || !thumbTip || !indexMcp || !middleMcp || !ringMcp || !pinkyMcp) {
      return "";
    }
    const thumbToIndex = getDistance(thumbTip, indexMcp);
    const thumbToMiddle = getDistance(thumbTip, middleMcp);
    const thumbToRing = getDistance(thumbTip, ringMcp);
    const thumbToPinky = getDistance(thumbTip, pinkyMcp);
    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];
    const thumbToIndexTip = indexTip ? getDistance(thumbTip, indexTip) : 99;
    const thumbToMiddleTip = middleTip ? getDistance(thumbTip, middleTip) : 99;
    const thumbToRingTip = ringTip ? getDistance(thumbTip, ringTip) : 99;
    const thumbToPinkyTip = pinkyTip ? getDistance(thumbTip, pinkyTip) : 99;
    const betweenIndexMiddle =
      thumbTip.x > Math.min(indexMcp.x, middleMcp.x) &&
      thumbTip.x < Math.max(indexMcp.x, middleMcp.x);
    const betweenMiddleRing =
      thumbTip.x > Math.min(middleMcp.x, ringMcp.x) &&
      thumbTip.x < Math.max(middleMcp.x, ringMcp.x);
    const betweenRingPinky =
      thumbTip.x > Math.min(ringMcp.x, pinkyMcp.x) &&
      thumbTip.x < Math.max(ringMcp.x, pinkyMcp.x);
    const betweenLoose =
      thumbTip.x > Math.min(indexMcp.x, middleMcp.x) - palmSize * 0.15 &&
      thumbTip.x < Math.max(indexMcp.x, middleMcp.x) + palmSize * 0.15;
    const thumbAwayFromRing = thumbToRing > thumbToIndex + palmSize * 0.06;
    const thumbAwayFromPinky = thumbToPinky > thumbToIndex + palmSize * 0.1;
    const tipIndexPreferred = thumbToIndexTip < thumbToMiddleTip * 0.95;
    const tipMiddlePreferred = thumbToMiddleTip < thumbToIndexTip * 0.95;
    if (
      (betweenIndexMiddle || betweenLoose) &&
      thumbToIndex < palmSize * 1.95 &&
      thumbToMiddle < palmSize * 1.95 &&
      thumbAwayFromRing &&
      thumbAwayFromPinky &&
      tipIndexPreferred
    ) {
      return "T";
    }
    if (
      (betweenMiddleRing || thumbToMiddle + palmSize * 0.04 < thumbToRing) &&
      thumbToMiddle < palmSize * 2.05 &&
      tipMiddlePreferred
    ) {
      return "N";
    }
    if (
      (betweenRingPinky ||
        (thumbToRing + palmSize * 0.04 < thumbToMiddle &&
          thumbToRing + palmSize * 0.08 < thumbToIndex)) &&
      thumbToRing < palmSize * 2.1
    ) {
      return "M";
    }
    const tipCloseCount = countThumbTipCloseToFingertips(hand, palmSize, 0.6);
    if (
      !betweenIndexMiddle &&
      thumbToMiddle < palmSize * 1.95 &&
      thumbToIndex < palmSize * 2.05 &&
      thumbToMiddle + palmSize * 0.12 < thumbToIndex &&
      thumbToMiddleTip < thumbToIndexTip * 0.95 &&
      tipCloseCount <= 1
    ) {
      return "S";
    }
    const maxThumbDist = palmSize * 2.05;
    const candidates = [
      { label: "M", dist: thumbToRing },
      { label: "N", dist: thumbToMiddle },
      {
        label: "S",
        dist: betweenIndexMiddle || tipIndexPreferred ? 99 : Math.min(thumbToMiddle, thumbToRing),
      },
    ]
      .filter((c) => c.dist < maxThumbDist)
      .sort((a, b) => a.dist - b.dist);
    if (candidates.length) {
      const best = candidates[0];
      const second = candidates[1];
      const diffSlack = palmSize * 0.08;
      if (!second || best.dist + diffSlack < second.dist) return best.label;
    }
    return "";
  }

  function isStrongQ(hand) {
    if (!hand || hand.length < 21) return false;
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const thumbExt = isThumbExtended(hand);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const ringExt = isFingerExtended(hand, 16, 14, 13);
    const pinkyExt = isFingerExtended(hand, 20, 18, 17);
    const middleCurled = isFingerCurled(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    const pinkyCurled = isFingerCurled(hand, 20, 18, 17);
    const indexTip = hand[8];
    const middleMcp = hand[9];
    const pointingDown = indexTip && middleMcp ? indexTip.y > middleMcp.y + 0.02 : false;
    return (
      indexExt &&
      thumbExt &&
      !middleExt &&
      !ringExt &&
      !pinkyExt &&
      middleCurled &&
      ringCurled &&
      pinkyCurled &&
      pointingDown
    );
  }

  function isStrongP(hand) {
    if (!hand || hand.length < 21) return false;
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const thumbExt = isThumbExtended(hand);
    const ringExt = isFingerExtended(hand, 16, 14, 13);
    const pinkyExt = isFingerExtended(hand, 20, 18, 17);
    const indexTip = hand[8];
    const middleMcp = hand[9];
    const pointingDown = indexTip && middleMcp ? indexTip.y > middleMcp.y + 0.02 : false;
    return indexExt && middleExt && thumbExt && !ringExt && !pinkyExt && pointingDown;
  }

  function getStrongHeuristicLetter(hand) {
    if (!hand || hand.length < 21) return "";
    if (isStrongE(hand)) return "E";
    if (isStrongO(hand) || isOishPose(hand)) return "O";
    if (isStrongA(hand)) return "A";
    if (isStrongB(hand)) return "B";
    if (isStrongD(hand)) return "D";
    if (isStrongG(hand)) return "G";
    if (isStrongH(hand)) return "H";
    if (isStrongS(hand)) return "S";
    if (isCishPose(hand)) return "C";
    if (isStrongC(hand)) return "C";
    if (isStrongY(hand)) return "Y";
    if (isStrongF(hand)) return "F";
    if (isStrongK(hand)) return "K";
    if (isStrongR(hand)) return "R";
    if (isStrongX(hand)) return "X";
    const fistLetter = classifyFistLetter(hand);
    if (fistLetter) return fistLetter;
    if (isStrongQ(hand)) return "Q";
    if (isStrongP(hand)) return "P";
    return "";
  }

  function isModelLabelPlausible(label, hand) {
    if (!label || !hand || hand.length < 21) return false;
    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );
    if (label === "C" || label === "O") {
      const bucket = classifyPoseBucket(hand);
      const cStrong = isStrongC(hand);
      const oStrong = isStrongO(hand) || isOishPose(hand);
      if (label === "C" && !cStrong && bucket !== "circle") return false;
      if (label === "O" && !oStrong && bucket !== "circle") return false;
    }
    const thumbExt = isThumbExtended(hand);
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const ringExt = isFingerExtended(hand, 16, 14, 13);
    const pinkyExt = isFingerExtended(hand, 20, 18, 17);
    const indexCurled = isFingerCurled(hand, 8, 6, 5);
    const middleCurled = isFingerCurled(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    const pinkyCurled = isFingerCurled(hand, 20, 18, 17);
    const indexExtLoose = isFingerExtendedLoose(hand, 8, 6, 5);
    const middleExtLoose = isFingerExtendedLoose(hand, 12, 10, 9);
    const ringExtLoose = isFingerExtendedLoose(hand, 16, 14, 13);
    const pinkyExtLoose = isFingerExtendedLoose(hand, 20, 18, 17);
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const indexPip = hand[6];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];
    const wrist = hand[0];
    const indexMcp = hand[5];
    const middleMcp = hand[9];
    const ringMcp = hand[13];
    const pinkyMcp = hand[17];
    const indexUp = indexTip && indexMcp ? indexTip.y < indexMcp.y - 0.04 : false;
    const middleUp = middleTip && middleMcp ? middleTip.y < middleMcp.y - 0.04 : false;
    const ringUp = ringTip && ringMcp ? ringTip.y < ringMcp.y - 0.04 : false;
    const pinkyUp = pinkyTip && pinkyMcp ? pinkyTip.y < pinkyMcp.y - 0.04 : false;
    const tipsNear = indexTip && middleTip ? getDistance(indexTip, middleTip) : 99;
    const thumbIndexGap = thumbTip && indexTip ? getDistance(thumbTip, indexTip) : 99;
    const arcWidth = indexTip && pinkyTip ? getDistance(indexTip, pinkyTip) : 0;
    const thumbToIndex = thumbTip && indexMcp ? getDistance(thumbTip, indexMcp) : 99;
    const thumbToMiddle = thumbTip && middleMcp ? getDistance(thumbTip, middleMcp) : 99;
    const thumbToRing = thumbTip && ringMcp ? getDistance(thumbTip, ringMcp) : 99;
    const thumbNearPalm =
      thumbTip && indexMcp ? getDistance(thumbTip, indexMcp) < palmSize * 1.7 : false;
    const thumbToIndexTip = thumbTip && indexTip ? getDistance(thumbTip, indexTip) : 99;
    const thumbToMiddleTip = thumbTip && middleTip ? getDistance(thumbTip, middleTip) : 99;
    const curl = averageCurl(hand, [8, 12, 16, 20]);
    const allCurled = !indexExt && !middleExt && !ringExt && !pinkyExt;
    const allExtended = indexExt && middleExt && ringExt && pinkyExt;
    const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;
    const fistLike = allCurled && curl > 0.55 && extendedCount <= 1;
    const fistCandidate = curl > 0.48 && extendedCount <= 2 && (!thumbExt || thumbNearPalm);
    const extendedLooseCount = [indexExtLoose, middleExtLoose, ringExtLoose, pinkyExtLoose].filter(Boolean).length;
    const fistCandidateLoose = curl > 0.4 && extendedLooseCount <= 2 && (!thumbExt || thumbNearPalm);
    const thumbTucked = !thumbExt && thumbTip && indexMcp
      ? getDistance(thumbTip, indexMcp) < palmSize * 1.25
      : !thumbExt;
    const thumbTuckedLoose = !thumbExt && thumbTip && indexMcp
      ? getDistance(thumbTip, indexMcp) < palmSize * 1.7
      : !thumbExt;
    const betweenIndexMiddle =
      thumbTip &&
      indexMcp &&
      middleMcp &&
      thumbTip.x > Math.min(indexMcp.x, middleMcp.x) &&
      thumbTip.x < Math.max(indexMcp.x, middleMcp.x);
    const betweenLoose =
      thumbTip &&
      indexMcp &&
      middleMcp &&
      thumbTip.x > Math.min(indexMcp.x, middleMcp.x) - palmSize * 0.15 &&
      thumbTip.x < Math.max(indexMcp.x, middleMcp.x) + palmSize * 0.15;
    const pointingDown = indexTip && middleMcp ? indexTip.y > middleMcp.y + 0.02 : false;
    const rotationHeavy = isRotationHeavy(hand);
    const tipCloseCount = countThumbTipCloseToFingertips(hand, palmSize, 0.6);
    const fistHint = classifyFistLetter(hand);

    if (allExtended && !thumbExt && label !== "B") return false;
    if (fistLike && !["A", "E", "M", "N", "S", "T", "C", "O"].includes(label)) return false;
    if (rotationHeavy && ROTATION_SENSITIVE_LABELS.has(label)) {
      if (label === "C") {
        if (isGishPose(hand)) return false;
        const arcOk = arcWidth > palmSize * 0.65 && arcWidth < palmSize * 2.2;
        const gapOk = thumbIndexGap > palmSize * 0.38 && thumbIndexGap < palmSize * 1.8;
        const indexBent = !indexExtLoose;
        const middleBent = !middleExtLoose;
        const ringBent = !ringExtLoose;
        const pinkyBent = !pinkyExtLoose;
        const bentCount = [indexBent, middleBent, ringBent, pinkyBent].filter(Boolean).length;
        const bentOk = indexBent && middleBent && bentCount >= 3;
        return isStrongC(hand) || (arcOk && gapOk && curl > 0.15 && bentOk);
      }
      if (label === "O") {
        const tipClose = thumbIndexGap < palmSize * 0.5;
        return (
          isStrongO(hand) ||
          isOishPose(hand) ||
          (tipClose && curl > 0.45 && arcWidth < palmSize * 1.35)
        );
      }
      return true;
    }

    switch (label) {
      case "A":
        return (
          (isStrongA(hand) || (fistLike && thumbTucked && curl > 0.55)) &&
          !isStrongE(hand) &&
          !isOishPose(hand) &&
          !isCishPose(hand) &&
          thumbIndexGap > palmSize * 0.4
        );
      case "E":
        return (
          isStrongE(hand) ||
          (fistLike &&
            thumbTucked &&
            curl > 0.6 &&
            tipCloseCount >= 3 &&
            !isStrongS(hand) &&
            !isCishPose(hand))
        );
      case "R": {
        if (isStrongA(hand)) return false;
        const closeTips = tipsNear < palmSize * 0.35;
        const sameHeight = indexTip && middleTip
          ? Math.abs(indexTip.y - middleTip.y) < 0.15
          : false;
        const heightOk = rotationHeavy ? true : sameHeight;
        const upOk = rotationHeavy ? true : indexUp && middleUp;
        return (
          (indexExtLoose || indexExt) &&
          (middleExtLoose || middleExt) &&
          ringCurled &&
          pinkyCurled &&
          (thumbTucked || thumbTuckedLoose) &&
          closeTips &&
          heightOk &&
          upOk &&
          !fistLike &&
          curl < 0.6
        );
      }
      case "U": {
        return (
          indexExtLoose &&
          middleExtLoose &&
          !ringExtLoose &&
          !pinkyExtLoose &&
          (thumbTucked || thumbTuckedLoose) &&
          tipsNear < palmSize * 0.45 &&
          !fistCandidate
        );
      }
      case "V": {
        return (
          indexExtLoose &&
          middleExtLoose &&
          !ringExtLoose &&
          !pinkyExtLoose &&
          (thumbTucked || thumbTuckedLoose) &&
          tipsNear >= palmSize * 0.45 &&
          !fistCandidate
        );
      }
      case "W": {
        return (
          indexExtLoose &&
          middleExtLoose &&
          ringExtLoose &&
          !pinkyExtLoose &&
          thumbTucked &&
          !fistLike
        );
      }
      case "L":
        {
          const indexOk = indexExt || indexExtLoose;
          const otherOff = !middleExtLoose && !ringExtLoose && !pinkyExtLoose;
          const upOk = rotationHeavy ? true : !pointingDown;
          return indexOk && thumbExt && otherOff && upOk;
        }
      case "C":
        {
          if (isStrongD(hand)) return false;
          if (isStrongG(hand) || isStrongH(hand)) return false;
          if (isGishPose(hand)) return false;
          const arcOk = arcWidth > palmSize * 0.7 && arcWidth < palmSize * 2.1;
          const gapOk = thumbIndexGap > palmSize * 0.42 && thumbIndexGap < palmSize * 1.6;
          const indexBent = !indexExtLoose;
          const middleBent = !middleExtLoose;
          const ringBent = !ringExtLoose;
          const pinkyBent = !pinkyExtLoose;
          const bentCount = [indexBent, middleBent, ringBent, pinkyBent].filter(Boolean).length;
          const bentOk = indexBent && middleBent && bentCount >= 3;
          return isStrongC(hand) || (arcOk && gapOk && curl > 0.2 && curl < 0.85 && bentOk);
        }
      case "O":
        {
          const tipCloserThanMcp =
            thumbIndexGap < palmSize * 0.45 && thumbToIndex
              ? thumbIndexGap < thumbToIndex * 0.85
              : false;
          return (
            isStrongO(hand) ||
            isOishPose(hand) ||
            (tipCloserThanMcp &&
              curl > 0.42 &&
              indexCurled &&
              middleCurled &&
              ringCurled &&
              pinkyCurled &&
              arcWidth < palmSize * 1.6)
          );
        }
      case "Y":
        return isStrongY(hand) || (thumbExt && pinkyExt && indexCurled && middleCurled && ringCurled);
      case "D":
        return (
          indexExt &&
          middleCurled &&
          ringCurled &&
          pinkyCurled &&
          thumbTip &&
          middleTip &&
          getDistance(thumbTip, middleTip) < palmSize * 0.45
        );
      case "F":
        return (
          middleExtLoose &&
          ringExtLoose &&
          pinkyExtLoose &&
          (indexCurled || !indexExtLoose) &&
          thumbTip &&
          indexTip &&
          getDistance(thumbTip, indexTip) < palmSize * 0.42 &&
          !fistLike
        );
      case "G": {
        const horizontal =
          indexTip && indexMcp ? Math.abs(indexTip.y - indexMcp.y) < palmSize * 0.35 : false;
        const sideways =
          indexTip && indexMcp ? Math.abs(indexTip.x - indexMcp.x) > palmSize * 0.35 : false;
        return (
          indexExtLoose &&
          thumbExt &&
          middleCurled &&
          ringCurled &&
          pinkyCurled &&
          horizontal &&
          sideways &&
          !fistLike
        );
      }
      case "H": {
        const horizontalIndex =
          indexTip && indexMcp ? Math.abs(indexTip.y - indexMcp.y) < palmSize * 0.35 : false;
        const horizontalMiddle =
          middleTip && middleMcp ? Math.abs(middleTip.y - middleMcp.y) < palmSize * 0.35 : false;
        return (
          indexExtLoose &&
          middleExtLoose &&
          ringCurled &&
          pinkyCurled &&
          thumbTucked &&
          tipsNear < palmSize * 0.35 &&
          horizontalIndex &&
          horizontalMiddle &&
          !fistLike
        );
      }
      case "K": {
        const thumbBetween =
          thumbTip && indexMcp && middleMcp
            ? thumbTip.x > Math.min(indexMcp.x, middleMcp.x) &&
              thumbTip.x < Math.max(indexMcp.x, middleMcp.x)
            : false;
        return (
          indexExt &&
          middleExt &&
          ringCurled &&
          pinkyCurled &&
          thumbExt &&
          thumbBetween
        );
      }
      case "X": {
        if (!indexTip || !indexPip || !indexMcp) return false;
        const angle = getAngle(indexMcp, indexPip, indexTip);
        const tipDist = getDistance(indexTip, indexMcp);
        const boneDist = getDistance(indexPip, indexMcp);
        const bentHook = angle > 1.4 && angle < 2.7;
        const notFullyCurled = tipDist > boneDist * 0.55 && tipDist < boneDist * 1.35;
        return (
          !indexExt &&
          indexCurled &&
          middleCurled &&
          ringCurled &&
          pinkyCurled &&
          bentHook &&
          notFullyCurled &&
          indexTip.y < indexMcp.y + 0.04 &&
          !fistCandidate
        );
      }
      case "Q":
        return (
          indexExt &&
          thumbExt &&
          !middleExt &&
          !ringExt &&
          !pinkyExt &&
          middleCurled &&
          ringCurled &&
          pinkyCurled &&
          pointingDown &&
          indexUp === false &&
          !fistLike
        );
      case "P":
        return (
          indexExt &&
          middleExt &&
          thumbExt &&
          !ringExt &&
          !pinkyExt &&
          pointingDown &&
          (indexUp === false || middleUp === false) &&
          !fistLike
        );
      case "T":
        {
          const betweenStrict = betweenIndexMiddle;
          const thumbAwayFromRing = thumbToRing > thumbToIndex + palmSize * 0.06;
          const thumbAwayFromPinky = thumbToPinky > thumbToIndex + palmSize * 0.1;
          const tipIndexPreferred = thumbToIndexTip < thumbToMiddleTip * 0.95;
          return (
            fistHint === "T" ||
            ((fistCandidate || fistCandidateLoose) &&
              (thumbTucked || thumbTuckedLoose) &&
              !isCishPose(hand) &&
              betweenLoose &&
              (betweenStrict || rotationHeavy) &&
              thumbToIndex < palmSize * 2.2 &&
              thumbToMiddle < palmSize * 2.2 &&
              thumbAwayFromRing &&
              thumbAwayFromPinky &&
              tipIndexPreferred)
          );
        }
      case "M":
        return (
          fistHint === "M" ||
          ((fistCandidate || fistCandidateLoose) &&
            (thumbTucked || thumbTuckedLoose) &&
            !isCishPose(hand) &&
            thumbToRing < palmSize * 2.1 &&
            thumbToRing + palmSize * 0.03 < thumbToMiddle)
        );
      case "N":
        return (
          fistHint === "N" ||
          ((fistCandidate || fistCandidateLoose) &&
            (thumbTucked || thumbTuckedLoose) &&
            !isCishPose(hand) &&
            thumbToMiddle < palmSize * 2.1 &&
            thumbToMiddle + palmSize * 0.03 < thumbToRing)
        );
      case "S":
        return (
          isStrongS(hand) ||
          fistHint === "S" ||
          ((fistCandidate || fistCandidateLoose) &&
            (thumbTucked || thumbTuckedLoose) &&
            !isCishPose(hand) &&
            !betweenLoose &&
            tipCloseCount <= 1 &&
            thumbToMiddle < palmSize * 1.9 &&
            thumbToMiddle + palmSize * 0.02 < thumbToIndex &&
            thumbToMiddleTip < thumbToIndexTip * 0.95)
        );
      default:
        return true;
    }
  }

  // --------- LETTER CLASSIFIER (A,B,C,L,I,Y,O) ----------
  function analyzeSingleHandForAlphabet(hand) {
    if (!hand || hand.length < 21) return "UNKNOWN";

    const strongLetter = getStrongHeuristicLetter(hand);
    if (strongLetter) return strongLetter;

    const palmSize = Math.max(
      0.0001,
      getDistance(hand[0], hand[9]) || getDistance(hand[0], hand[5]) || 0.08
    );

    const thumbExt = isThumbExtended(hand);
    const indexExt = isFingerExtended(hand, 8, 6, 5);
    const middleExt = isFingerExtended(hand, 12, 10, 9);
    const ringExt = isFingerExtended(hand, 16, 14, 13);
    const pinkyExt = isFingerExtended(hand, 20, 18, 17);

    const indexCurled = isFingerCurled(hand, 8, 6, 5);
    const middleCurled = isFingerCurled(hand, 12, 10, 9);
    const ringCurled = isFingerCurled(hand, 16, 14, 13);
    const pinkyCurled = isFingerCurled(hand, 20, 18, 17);

    const allCurled = !indexExt && !middleExt && !ringExt && !pinkyExt;
    const allExtended = indexExt && middleExt && ringExt && pinkyExt;
    const fingersTogether = areFingersTogether(hand);
    const curl = averageCurl(hand, [8, 12, 16, 20]);

    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const xs = hand.map((p) => p.x);
    const ys = hand.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    const flatRatio = h > 0 ? w / h : 99;

    if (isStrongA(hand)) return "A";
    if (isStrongB(hand)) return "B";

    if (isStrongC(hand)) return "C";

    // L - index + thumb extended, others curled
    if ((indexExt || isFingerExtendedLoose(hand, 8, 6, 5)) && thumbExt) {
      const middleOff = !isFingerExtendedLoose(hand, 12, 10, 9);
      const ringOff = !isFingerExtendedLoose(hand, 16, 14, 13);
      const pinkyOff = !isFingerExtendedLoose(hand, 20, 18, 17);
      if (middleOff && ringOff && pinkyOff) {
        if (Math.abs(thumbTip.x - indexTip.x) > palmSize * 0.35) return "L";
      }
    }

    // I - pinky only, thumb tucked in
    if (
      pinkyExt &&
      !indexExt &&
      !middleExt &&
      !ringExt &&
      !thumbExt &&
      curl > 0.25 &&
      getDistance(thumbTip, hand[2]) < palmSize * 0.8
    ) {
      return "I";
    }

    // Y - thumb + pinky extended, middle three curled
    if (
      thumbExt &&
      pinkyExt &&
      indexCurled &&
      middleCurled &&
      ringCurled &&
      getDistance(thumbTip, hand[3]) > 0.03
    ) {
      return "Y";
    }

    if (isStrongO(hand)) return "O";

    return "UNKNOWN";
  }

  function interpretFromMulti(landmarks) {
    if (!landmarks || !landmarks.length) {
      return { label: "No hands detected", letter: "", pattern: "NONE" };
    }

    const letter = analyzeSingleHandForAlphabet(landmarks[0]);

    if (!allowedLetters.current.has(letter)) {
      return {
        label: "Hand detected - hold steady for classification.",
        letter: "",
        pattern: "UNKNOWN",
      };
    }

    return { label: `Letter: ${letter}`, letter, pattern: "LETTER" };
  }

  function applyMapping(interp) {
    if (!interp) return "";
    if (interp.pattern === "LETTER") return interp.letter;
    return interp.label || "";
  }

  function sanitizeModelLabel(label) {
    if (!label || label === "nothing") return "";
    if (DYNAMIC_LABELS.has(label)) return "";
    return label;
  }

  function sendLiveLabel(label) {
    const now = Date.now();
    if (label === lastLiveSendRef.current.label && now - lastLiveSendRef.current.ts < 400) return;
    lastLiveSendRef.current = { label, ts: now };
    sendRoomPayload({ type: "live-label", label });
  }

  // ---------------- HANDLE FRAME ----------------
  function handleHandResult(result, now) {
    const canvas = canvasRef.current;
    const video = localVideoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const hasStream = !!video.srcObject;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const rect = video.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const displayW = rect.width || canvasRect.width || video.clientWidth || vw;
    const displayH = rect.height || canvasRect.height || video.clientHeight || vh;
    if (!displayW || !displayH) return;
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const canvasW = Math.max(1, Math.round(displayW * dpr));
    const canvasH = Math.max(1, Math.round(displayH * dpr));
    if (canvas.width !== canvasW) canvas.width = canvasW;
    if (canvas.height !== canvasH) canvas.height = canvasH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayW, displayH);

    const scale = Math.min(displayW / vw, displayH / vh);
    const renderW = vw * scale;
    const renderH = vh * scale;
    const offsetX = (displayW - renderW) / 2;
    const offsetY = (displayH - renderH) / 2;

    if (!hasStream) {
      setDetectionConfidence(0);
      setLocalLabel("Waiting for gesture");
      return;
    }

    const rawHands = result?.landmarks || [];
    const handednesses = result?.handednesses || result?.handedness || [];
    const rawPrimary = rawHands[0];
    const primaryHandedness = handednesses?.[0];
    const handednessLabel = Array.isArray(primaryHandedness)
      ? primaryHandedness?.[0]?.categoryName
      : primaryHandedness?.categoryName;
    const handednessScore = Array.isArray(primaryHandedness)
      ? primaryHandedness?.[0]?.score
      : primaryHandedness?.score;
    const rawPresence = getHandPresence(rawPrimary, handednesses);
    const stableOk = rawPresence.ok || rawPresence.score >= 0.08;  // Reduced from 0.15 for better detection
    const stabilized = stabilizeHands(rawHands, stableOk);
    const hands = smoothHands(stabilized, stableOk);
    const primaryHand = hands[0];
    const presence = getHandPresence(primaryHand, handednesses);
    
    // Validate palm landmark accuracy
    const palmValidation = validatePalmLandmarks(primaryHand);
    const hasHand = !!primaryHand && (presence?.score ?? 0) >= 0.05 && palmValidation.valid;  // Reduced from 0.15
    if (hasHand) {
      lastHandMetaRef.current = {
        handedness: handednessLabel || "",
        score: handednessScore || 0,
        confidence: presence?.score ?? 0,
      };
    }
    const poseBucket = classifyPoseBucket(primaryHand);
    const nowTs = Date.now();
    let tfPred = null;
    if (USE_TF_MODEL && tfModel && hasHand) {
      const normVec = normalizeLandmarks(primaryHand, handednessLabel, handednessScore, {
        mirrorLeft: MIRROR_LEFT_HAND,
      });
      if (normVec) {
        try {
          tfPred = tf.tidy(() => {
            const input = tf.tensor([normVec]);
            const output = tfModel.predict(input);
            const data = output.dataSync();
            let bestIdx = 0;
            let bestVal = -Infinity;
            for (let i = 0; i < data.length; i++) {
              if (data[i] > bestVal) {
                bestVal = data[i];
                bestIdx = i;
              }
            }
            return { label: FULL_LABEL_SET[bestIdx], conf: bestVal };
          });
        } catch (err) {
          // ignore TF errors, fallback to builtin pipeline
          tfPred = null;
        }
      }
    }

    const mirrorX = true;
    const mapPoint = (p) => {
      const nx = mirrorX ? 1 - clamp01(p.x) : clamp01(p.x);
      return {
        x: nx * renderW + offsetX,
        y: clamp01(p.y) * renderH + offsetY,
      };
    };

    const drawHands = showLandmarks && hasHand && primaryHand ? [primaryHand] : [];
    if (drawHands.length) {
      // Draw landmarks in the same space as the mirrored video
      ctx.save();
      ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
      ctx.fillStyle = "rgba(0, 255, 0, 0.9)";

      drawHands.forEach((hand) => {
        // Calculate and draw palm center (wrist to hand center)
        const wrist = hand[0];
        const centerPoint = {
          x: (hand[5].x + hand[9].x + hand[17].x) / 3 + (wrist.x - hand[0].x) / 3,
          y: (hand[5].y + hand[9].y + hand[17].y) / 3 + (wrist.y - hand[0].y) / 3,
        };
        const { x: palmX, y: palmY } = mapPoint(centerPoint);
        
        // Draw palm center as larger circle
        ctx.fillStyle = "rgba(255, 100, 0, 0.95)";
        ctx.beginPath();
        ctx.arc(palmX, palmY, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw individual landmarks
        ctx.fillStyle = "rgba(0, 255, 0, 0.9)";
        hand.forEach((p, idx) => {
          const { x: px, y: py } = mapPoint(p);
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,0,0.8)";
          ctx.font = "10px sans-serif";
          ctx.fillText(String(idx), px + 5, py - 5);
          ctx.fillStyle = "rgba(0, 255, 0, 0.9)";
        });
        
        // Draw hand structure connections
        ctx.beginPath();
        const seq = [0, 1, 2, 3, 4, 3, 2, 5, 6, 7, 8, 5, 9, 10, 11, 12, 9, 13, 14, 15, 16, 13, 17, 18, 19, 20];
        seq.forEach((idx, i) => {
          const p = hand[idx];
          if (!p) return;
          const { x: px, y: py } = mapPoint(p);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });

      ctx.restore();
    }

    if (!hasHand) {
      frameHistory.current = [];
      labelHistory.current = [];
      const noHandLabel = hands.length
        ? "Hand too far - move closer to the camera."
        : "No hands detected";
      setLocalLabel(noHandLabel);
      sendLiveLabel(noHandLabel);
      setDetectionConfidence(0);
      if (letterSequence.length === 0) {
        lastSpokenRef.current = "";
      }

      const c = candidateRef.current;
      if (c.letter && now - c.lastSeenAt > 500) {
        candidateRef.current = { letter: "", startedAt: 0, lastSeenAt: 0 };
      }

      const liveLetters = letterSequenceRef.current?.length ? letterSequenceRef.current : letterSequence;
      const phrase = liveLetters.join("");
      const recentlyHadHand = now - lastHandSeenRef.current < 2500; // debounce when tabbed away/paused
      if (autoSpeakRef.current && phrase && recentlyHadHand) {
        // Speak the assembled phrase once when hand is absent
        if (noDetectionTimeout.current) {
          clearTimeout(noDetectionTimeout.current);
          noDetectionTimeout.current = null;
        }
        noDetectionTimeout.current = setTimeout(() => {
          if (skipSpeakRef.current) {
            skipSpeakRef.current = false;
            noDetectionTimeout.current = null;
            return;
          }
          if (speakingRef.current && typeof window !== "undefined") {
            try {
              window.speechSynthesis.cancel();
            } catch {
              /* ignore */
            }
            speakingRef.current = false;
          }
          // avoid repeating identical phrase unless letters changed
          if (phrase !== lastAutoSpokenPhraseRef.current) {
            speakLettersThenPhrase(liveLetters, true);
            lastAutoSpokenPhraseRef.current = phrase;
          }
          pendingAutoSpeakRef.current = false;
          noDetectionTimeout.current = null;
        }, NO_DETECT_SPEAK_MS);
      }

      const noHandMs = now - lastHandSeenRef.current;
      candidateRef.current = { letter: "", startedAt: 0, lastSeenAt: 0 };
      modelPredRef.current = { label: "", conf: 0, ts: 0 };
      modelHistoryRef.current = [];
      normHistoryRef.current = [];
      motionHistoryRef.current = [];  // Reset motion history for J and Z
      lastNormVecRef.current = null;
      lastNormVecTsRef.current = 0;
      lastStableLabelRef.current = { label: "", ts: 0 };
      lastPoseVecRef.current = null;
      lastBackendVecRef.current = null;
      poseStableSinceRef.current = 0;
      if (noHandMs > REPEAT_SAME_LETTER_GAP_MS) {
        confirmLockRef.current = "";
        lastConfirmRef.current = { letter: "", ts: 0 };
      }
      if (lastBackendPredictRef.current.pending && lastBackendPredictRef.current.controller) {
        try {
          lastBackendPredictRef.current.controller.abort();
        } catch {
          /* ignore */
        }
        lastBackendPredictRef.current.pending = false;
        lastBackendPredictRef.current.controller = null;
      }
      return;
    }

    // we have a hand, cancel pending phrase-speak
    if (noDetectionTimeout.current) {
      clearTimeout(noDetectionTimeout.current);
      noDetectionTimeout.current = null;
    }
    if (letterSequenceRef.current.length > 0) {
      pendingAutoSpeakRef.current = true;
      lastAutoSpokenPhraseRef.current = "";
    }

    // mark last time a hand was seen for debouncing no-hand auto-speak
    lastHandSeenRef.current = now;

    const base = clamp01(computeBaseScore(result) * (presence.score || 1));
    const stability = computeStabilityScore(hands);
    const bucketStabilityMin = poseBucket === "fist" ? 0.08 : 0.12;  // Reduced for better detection
    const bucketPresenceMin = poseBucket === "fist" ? 0.2 : 0.25;    // Reduced for better detection
    const interp = interpretFromMulti(hands);
    const strongA = hasHand ? isStrongA(primaryHand) : false;
    const strongB = hasHand ? isStrongB(primaryHand) : false;
    const consistency = computeConsistencyScore(interp.label);
    const reliableHand =
      hasHand && presence.score >= bucketPresenceMin && stability >= bucketStabilityMin;
    if (!reliableHand && (!primaryHand || (presence.score < 0.15 && stability < 0.12))) {
      modelPredRef.current = { label: "", conf: 0, ts: 0 };
      modelHistoryRef.current = [];
      lastStableLabelRef.current = { label: "", ts: 0 };
    }
    if (reliableHand) {
      const normVec = normalizeLandmarks(primaryHand, handednessLabel, handednessScore, {
        mirrorLeft: MIRROR_LEFT_HAND,
      });
      if (normVec) {
        lastNormVecRef.current = normVec;
      }
      if (normVec && nowTs - lastNormVecTsRef.current >= MIN_NORM_INTERVAL_MS) {
        normHistoryRef.current.push(normVec);
        lastNormVecTsRef.current = nowTs;
        if (normHistoryRef.current.length > MODEL_INPUT_FRAMES) {
          normHistoryRef.current.shift();
        }
      }
    }

    const hybrid = base * 0.4 + stability * 0.3 + consistency * 0.3;
    const score = Math.round(hybrid * 100);

    // If TF.js or backend prediction is available, override label/letter
    const handRecentlySeen = now - lastHandSeenRef.current < 400;

    // Use a stabilized model prediction if available
    const recent = modelHistoryRef.current.filter(
      (p) => nowTs - p.ts < MODEL_HISTORY_WINDOW_MS
    );
    const stablePred = (() => {
      const valid = recent.filter((p) => sanitizeModelLabel(p.label));
      const counts = new Map();
      const sums = new Map();
      const margins = new Map();
      valid.forEach((p) => {
        counts.set(p.label, (counts.get(p.label) || 0) + 1);
        sums.set(p.label, (sums.get(p.label) || 0) + (p.conf || 0));
        margins.set(p.label, (margins.get(p.label) || 0) + (p.margin || 0));
      });
      let bestLabel = "";
      let bestCount = 0;
      counts.forEach((count, label) => {
        if (count > bestCount) {
          bestCount = count;
          bestLabel = label;
        }
      });
      const avgConf = (sums.get(bestLabel) || 0) / bestCount;
      const avgMargin = (margins.get(bestLabel) || 0) / bestCount;
      const safeLabel = sanitizeModelLabel(bestLabel);
      if (!safeLabel) return null;
      const cGish = safeLabel === "C" && isGishPose(primaryHand);
      const overrideCandidate =
        HIGH_CONF_OVERRIDE_LABELS.has(safeLabel) &&
        avgConf >= HIGH_CONF_OVERRIDE_CONF &&
        avgMargin >= HIGH_CONF_OVERRIDE_MARGIN &&
        !(safeLabel === "C" && (isStrongG(primaryHand) || isStrongH(primaryHand) || cGish));
      if (!overrideCandidate) {
        if (!isLabelAllowedForBucket(safeLabel, poseBucket)) return null;
        if (!isModelLabelPlausible(safeLabel, primaryHand)) return null;
      }
      const strictLabel =
        (STRICT_LABELS.has(safeLabel) && !overrideCandidate) || safeLabel === "space";
      const minHits = strictLabel ? MODEL_MIN_HITS_STRICT : MODEL_MIN_HITS;
      if (valid.length < minHits || bestCount < minHits || bestLabel === "nothing") return null;
      const hitRatio = bestCount / Math.max(valid.length, 1);
      const ratioMin = strictLabel ? MODEL_MIN_HIT_RATIO_STRICT : MODEL_MIN_HIT_RATIO;
      if (hitRatio < ratioMin) return null;
      const { conf: confMin, margin: marginMin } = getLabelThresholds(safeLabel, strictLabel);
      const marginReq = overrideCandidate ? HIGH_CONF_OVERRIDE_MARGIN : marginMin;
      if (avgConf < confMin || avgMargin < marginReq) return null;
      return { label: safeLabel, conf: avgConf, margin: avgMargin };
    })();
    if (stablePred?.label) {
      lastStableLabelRef.current = { label: stablePred.label, ts: nowTs };
    }
    const stableHold = lastStableLabelRef.current;
    const heldStableLabel =
      stableHold.label && nowTs - stableHold.ts < STABLE_LABEL_HOLD_MS
        ? stableHold.label
        : "";

    const recentModel = modelPredRef.current;
    const recentModelOk =
      sanitizeModelLabel(recentModel?.label) &&
      nowTs - recentModel.ts < 1800 &&
      (() => {
        const safeLabel = sanitizeModelLabel(recentModel?.label);
        if (!safeLabel) return false;
        const cGish = safeLabel === "C" && isGishPose(primaryHand);
        const overrideCandidate =
          HIGH_CONF_OVERRIDE_LABELS.has(safeLabel) &&
          (recentModel.conf || 0) >= HIGH_CONF_OVERRIDE_CONF &&
          (recentModel.margin || 0) >= HIGH_CONF_OVERRIDE_MARGIN &&
          !(safeLabel === "C" && cGish);
        const strictLabel =
          (STRICT_LABELS.has(safeLabel) && !overrideCandidate) || safeLabel === "space";
        const { conf: confMin, margin: marginMin } = getLabelThresholds(safeLabel, strictLabel);
        const marginReq = overrideCandidate ? HIGH_CONF_OVERRIDE_MARGIN : marginMin;
        return (
          !!safeLabel &&
          (overrideCandidate ||
            (isModelLabelPlausible(safeLabel, primaryHand) &&
              isLabelAllowedForBucket(safeLabel, poseBucket))) &&
          (recentModel.conf || 0) >= confMin &&
          (recentModel.margin || 0) >= marginReq
        );
      })();
    const overrideModelLabel = (() => {
      const safeLabel = sanitizeModelLabel(recentModel?.label);
      if (!safeLabel) return "";
      if (!HIGH_CONF_OVERRIDE_LABELS.has(safeLabel)) return "";
      if ((recentModel.conf || 0) < HIGH_CONF_OVERRIDE_CONF) return "";
      if ((recentModel.margin || 0) < HIGH_CONF_OVERRIDE_MARGIN) return "";
    if (presence.score < 0.3) return "";
      if (
        safeLabel === "C" &&
        (isStrongG(primaryHand) || isStrongH(primaryHand) || isGishPose(primaryHand))
      ) {
        return "";
      }
      return safeLabel;
    })();

    const modelLabel =
      stablePred?.label ||
      heldStableLabel ||
      (recentModelOk ? sanitizeModelLabel(recentModel.label) : "") ||
      (tfPred?.label ? sanitizeModelLabel(tfPred.label) : "");
    let effectiveModelLabel = modelLabel;
    let effectiveModelConf =
      stablePred?.conf ?? (recentModelOk ? recentModel.conf : 0) ?? tfPred?.conf ?? 0;
    let effectiveModelMargin =
      stablePred?.margin ?? (recentModelOk ? recentModel.margin : 0) ?? 0;
    if (
      effectiveModelLabel &&
      (!isModelLabelPlausible(effectiveModelLabel, primaryHand) ||
        !isLabelAllowedForBucket(effectiveModelLabel, poseBucket))
    ) {
      effectiveModelLabel = "";
      effectiveModelConf = 0;
      effectiveModelMargin = 0;
    }
    if (!reliableHand && !overrideModelLabel) {
      effectiveModelLabel = "";
      effectiveModelConf = 0;
      effectiveModelMargin = 0;
    }
    if (!effectiveModelLabel && overrideModelLabel) {
      effectiveModelLabel = overrideModelLabel;
      effectiveModelConf = recentModel?.conf ?? 0;
      effectiveModelMargin = recentModel?.margin ?? 0;
    }
    if (strongA && (!effectiveModelLabel || effectiveModelLabel !== "A")) {
      effectiveModelLabel = "A";
      effectiveModelConf = Math.max(effectiveModelConf, 0.92);
      effectiveModelMargin = Math.max(effectiveModelMargin, 0.28);
    }
    if (strongB && (!effectiveModelLabel || effectiveModelLabel !== "B")) {
      effectiveModelLabel = "B";
      effectiveModelConf = Math.max(effectiveModelConf, 0.9);
      effectiveModelMargin = Math.max(effectiveModelMargin, 0.25);
    }
    if (
      effectiveModelLabel &&
      (effectiveModelLabel === "A" || effectiveModelLabel === "E") &&
      isOishPose(primaryHand)
    ) {
      effectiveModelLabel = "";
      effectiveModelConf = 0;
      effectiveModelMargin = 0;
    }
    const strongHeuristic = reliableHand ? getStrongHeuristicLetter(primaryHand) : "";
    const modelStrong =
      effectiveModelLabel &&
      effectiveModelConf >= 0.86 &&
      effectiveModelMargin >= 0.14 &&
      !STRICT_LABELS.has(effectiveModelLabel);
    const forceHeuristic =
      strongHeuristic === "O" &&
      isOishPose(primaryHand) &&
      ["A", "E"].includes(effectiveModelLabel || "");
    const preferHeuristic =
      !effectiveModelLabel ||
      !modelStrong ||
      AMBIGUOUS_A_LABELS.has(effectiveModelLabel) ||
      (effectiveModelLabel === "A" && strongHeuristic === "O") ||
      forceHeuristic;
    if (
      strongHeuristic &&
      preferHeuristic &&
      (!effectiveModelLabel || effectiveModelLabel !== strongHeuristic)
    ) {
      effectiveModelLabel = strongHeuristic;
      effectiveModelConf = Math.max(effectiveModelConf, 0.93);
      effectiveModelMargin = Math.max(effectiveModelMargin, 0.28);
    }
    const heuristicLetter = interp.pattern === "LETTER" ? interp.letter : "";
    const modelWeak =
      !effectiveModelLabel || effectiveModelConf < 0.85 || effectiveModelMargin < 0.12;
    if (heuristicLetter && (modelWeak || AMBIGUOUS_A_LABELS.has(effectiveModelLabel))) {
      effectiveModelLabel = heuristicLetter;
      effectiveModelConf = Math.max(effectiveModelConf, 0.9);
      effectiveModelMargin = Math.max(effectiveModelMargin, 0.25);
    }

    // Check for dynamic J and Z gestures using motion tracking
    if (hasHand && primaryHand) {
      motionHistoryRef.current.push(primaryHand);
      // Keep only last 10 frames for motion history
      if (motionHistoryRef.current.length > 10) {
        motionHistoryRef.current.shift();
      }

      // Detect J motion
      if (detectJMotion(primaryHand) && !effectiveModelLabel) {
        effectiveModelLabel = "J";
        effectiveModelConf = 0.92;
        effectiveModelMargin = 0.25;
        motionHistoryRef.current = []; // Reset after detection
      }

      // Detect Z motion
      if (detectZMotion(primaryHand) && !effectiveModelLabel) {
        effectiveModelLabel = "Z";
        effectiveModelConf = 0.92;
        effectiveModelMargin = 0.25;
        motionHistoryRef.current = []; // Reset after detection
      }
    }

    const stableLabel = stablePred?.label || "";
    const confirmedCandidateLabel = stableLabel || effectiveModelLabel || "";
    if (
      confirmLockRef.current &&
      confirmedCandidateLabel &&
      confirmedCandidateLabel !== confirmLockRef.current
    ) {
      const resetOk =
        stablePred?.label === confirmedCandidateLabel &&
        (stablePred?.conf ?? 0) >= MODEL_MIN_CONF_STRICT &&
        (stablePred?.margin ?? 0) >= MODEL_MIN_MARGIN_STRICT &&
        nowTs - lastConfirmRef.current.ts >= CONFIRM_COOLDOWN_MS;
      if (resetOk) {
        confirmLockRef.current = "";
      }
    }

    if (effectiveModelLabel) {
      interp.label = `Letter: ${effectiveModelLabel}`;
      interp.letter = effectiveModelLabel;
      interp.pattern = "LETTER";
      setDetectionConfidence(Math.round((effectiveModelConf || 0) * 100));
    } else {
      setDetectionConfidence(score);
      interp.label = "Hand detected - hold steady for classification.";
      interp.letter = "";
      interp.pattern = "UNKNOWN";
    }

    // backend predict (primary) - always try if we have a hand
    if (reliableHand) {
      const nowMs = Date.now();
      const state = lastBackendPredictRef.current;
      if (state.nextTs && nowMs < state.nextTs) {
        // backoff window active
      } else if (!state.pending && nowMs - state.ts > PREDICT_INTERVAL_MS) {
        if (stability < BACKEND_MIN_STABILITY || presence.score < BACKEND_MIN_PRESENCE) {
          lastBackendPredictRef.current.ts = nowMs;
        } else {
          if (normHistoryRef.current.length < MODEL_INPUT_FRAMES) {
            lastBackendPredictRef.current.ts = nowMs;
          } else {
            const avgVec = averageVectors(normHistoryRef.current);
            if (!avgVec) {
              lastBackendPredictRef.current.ts = nowMs;
            } else {
              const stableState = lastStableLabelRef.current;
              const stableRecent =
                stableState.label && nowMs - stableState.ts < STABLE_PREDICT_PAUSE_MS;
              const poseDelta = averageAbsDiff(avgVec, lastPoseVecRef.current);
              const poseStable = lastPoseVecRef.current
                ? poseDelta < MIN_POSE_DELTA
                : false;
              if (!poseStable) {
                poseStableSinceRef.current = 0;
                lastPoseVecRef.current = avgVec;
                lastBackendPredictRef.current.ts = nowMs;
              } else {
                if (!poseStableSinceRef.current) {
                  poseStableSinceRef.current = nowMs;
                }
                const poseHeld = nowMs - poseStableSinceRef.current;
                if (poseHeld < POSE_STABLE_HOLD_MS) {
                  lastBackendPredictRef.current.ts = nowMs;
                } else if (nowMs - state.ts < PREDICT_INTERVAL_STABLE_MS) {
                  // skip until stable interval has elapsed to avoid spamming
                } else {
                  const deltaSinceLastSend = averageAbsDiff(avgVec, lastBackendVecRef.current);
                  const poseChanged = deltaSinceLastSend >= BACKEND_POSE_CHANGE_MIN;
                  const needsRefresh = !recentModelOk && !stablePred?.label;
                  if (!poseChanged && !needsRefresh) {
                    lastBackendPredictRef.current.ts = nowMs;
                  } else if (stableRecent) {
                    lastBackendPredictRef.current.ts = nowMs;
                    lastBackendPredictRef.current.nextTs = nowMs + STABLE_PREDICT_PAUSE_MS;
                  } else {
                    lastPoseVecRef.current = avgVec;
                    lastBackendVecRef.current = avgVec;
                    const sendVec = avgVec;
                    const controller = new AbortController();
                    lastBackendPredictRef.current = {
                      ts: nowMs,
                      pending: true,
                      controller,
                      errorCount: state.errorCount || 0,
                      nextTs: state.nextTs || 0,
                    };
                    const timeoutId = setTimeout(() => {
                      try {
                        controller.abort();
                      } catch {
                        /* ignore */
                      }
                  }, 2000);
                    fetch(`${API_ORIGIN}/api/predict`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ features: sendVec }),
                      signal: controller.signal,
                    })
                      .then((r) => {
                        if (!r.ok) throw new Error("predict_failed");
                        return r.json();
                      })
                      .then((data) => {
                        const bestLabel = sanitizeModelLabel(data?.label);
                        const altLabel = sanitizeModelLabel(data?.top2_label);
                        const bestConf = data?.confidence || 0;
                        const altConf = data?.top2_confidence || 0;
                        const margin = data?.margin || 0;
                        const bestPlausible =
                          bestLabel && isModelLabelPlausible(bestLabel, primaryHand);
                        const altPlausible =
                          altLabel && isModelLabelPlausible(altLabel, primaryHand);
                        const useAlt = !bestPlausible && altPlausible;
                        const chosenLabel = useAlt ? altLabel : bestLabel;
                        const chosenConf = useAlt ? Math.max(altConf, bestConf * 0.85) : bestConf;
                        const chosenMargin = useAlt ? Math.max(MODEL_MIN_MARGIN, margin) : margin;
                        const nowEntry = Date.now();
                        if (
                          chosenLabel &&
                          chosenConf >= MODEL_STORE_MIN_CONF &&
                          (chosenMargin >= MODEL_STORE_MIN_MARGIN || useAlt)
                        ) {
                          const entry = {
                            label: chosenLabel,
                            conf: chosenConf,
                            margin: chosenMargin,
                            ts: nowEntry,
                          };
                          modelPredRef.current = entry;
                          if (nowEntry - lastHistoryPushRef.current >= MODEL_HISTORY_MIN_INTERVAL_MS) {
                            modelHistoryRef.current.push(entry);
                            lastHistoryPushRef.current = nowEntry;
                            if (modelHistoryRef.current.length > 12) {
                              modelHistoryRef.current.shift();
                            }
                          }
                          setDetectionConfidence(Math.round(chosenConf * 100));
                        }
                        lastBackendPredictRef.current.errorCount = 0;
                        lastBackendPredictRef.current.nextTs = 0;
                      })
                      .catch(() => {
                        const current = lastBackendPredictRef.current;
                        const errorCount = (current.errorCount || 0) + 1;
                        current.errorCount = errorCount;
                        current.nextTs =
                          Date.now() +
                          Math.min(PREDICT_BACKOFF_MS * errorCount, PREDICT_BACKOFF_MAX_MS);
                      })
                      .finally(() => {
                        clearTimeout(timeoutId);
                        lastBackendPredictRef.current.pending = false;
                        lastBackendPredictRef.current.controller = null;
                      });
                  }
                }
              }
            }
          }
        }
      }
    }

    const display = applyMapping(interp);
    setLocalLabel(display);
    sendLiveLabel(display);
    // reset phrase-spoken flag when letters are changing while a hand is present
    const currentPhrase = letterSequenceRef.current.join("");
    if (currentPhrase !== lastAutoSpokenPhraseRef.current) {
      pendingAutoSpeakRef.current = true;
      lastAutoSpokenPhraseRef.current = "";
    }

    sessionLogRef.current.push({
      ts: Date.now(),
      base,
      stability,
      consistency,
      hybrid: score,
      label: interp.label,
      letter: interp.letter,
    });

    const candidate = candidateRef.current;

    const confirmLetter = confirmedCandidateLabel || "";
    const needsHigher = interp.letter === "O";
    const strongConfirm = strongHeuristic && strongHeuristic === confirmLetter;
    const isFistLetter = ["A", "E", "S", "T", "M", "N"].includes(confirmLetter);
    const stabilityReq = strongConfirm ? 0.25 : needsHigher ? 0.42 : isFistLetter ? 0.3 : 0.35;
    const modelConf = stableLabel ? stablePred?.conf ?? 0 : effectiveModelConf;
    const modelMargin = stableLabel ? stablePred?.margin ?? 0 : effectiveModelMargin;
    const hasModelPred = !!confirmLetter;
    const overrideLetter =
      HIGH_CONF_OVERRIDE_LABELS.has(confirmLetter) &&
      modelConf >= HIGH_CONF_OVERRIDE_CONF &&
      modelMargin >= HIGH_CONF_OVERRIDE_MARGIN;
    const stabilityReqFinal = overrideLetter
      ? Math.min(stabilityReq, HIGH_CONF_OVERRIDE_STABILITY)
      : stabilityReq;
    const strictLabel = STRICT_LABELS.has(confirmLetter) || confirmLetter === "space";
    const { conf: confMin, margin: marginMin } = getLabelThresholds(confirmLetter, strictLabel);
    const nowMs = Date.now();
    const lastConfirm = lastConfirmRef.current;
    const cooldownOk = nowMs - lastConfirm.ts >= CONFIRM_COOLDOWN_MS;
    const sameLetter = confirmLetter === lastConfirm.letter;
    const repeatGapOk = !sameLetter || nowMs - lastConfirm.ts > REPEAT_SAME_LETTER_GAP_MS;
    const confOk =
      hasModelPred &&
      ((modelConf >= confMin && modelMargin >= marginMin) || overrideLetter) &&
      handRecentlySeen &&
      (reliableHand || overrideLetter) &&
      cooldownOk &&
      repeatGapOk;
    if (
      hasModelPred &&
      stability >= stabilityReqFinal &&
      confirmLetter &&
      confirmLockRef.current !== confirmLetter &&
      confOk &&
      allowedLetters.current.has(confirmLetter)
    ) {
      if (candidate.letter !== confirmLetter) {
        candidateRef.current = {
          letter: confirmLetter,
          startedAt: now,
          lastSeenAt: now,
        };
      } else {
        const held = now - candidate.startedAt;
        candidateRef.current.lastSeenAt = now;

        const holdMsBase = confirmLetter === "space" ? SPACE_CONFIRM_MS : getHoldMs(confirmLetter);
        const holdMs = strongConfirm ? Math.min(holdMsBase, 900) : holdMsBase;
        if (held >= holdMs) {
          confirmStableLetter(confirmLetter);
          candidateRef.current = { letter: "", startedAt: 0, lastSeenAt: 0 };
          frameHistory.current = [];
          labelHistory.current = [];
        }
      }
    } else {
      if (candidate.letter && now - candidate.lastSeenAt > 350) {
        candidateRef.current = { letter: "", startedAt: 0, lastSeenAt: 0 };
      }
    }
  }

  function computeConsistencyScore(label) {
    if (!label) return 0;
    labelHistory.current.push(label);
    if (labelHistory.current.length > 12) labelHistory.current.shift();
    const count = labelHistory.current.filter((l) => l === label).length;
    return count / labelHistory.current.length;
  }

  function confirmStableLetter(letter) {
    if (!letter || letter === "nothing") return;
    // avoid leading spaces and duplicates
    const currentSeq = letterSequenceRef.current || [];
    if (letter === "space") {
      if (!currentSeq.length) return; // no leading space
      if (currentSeq[currentSeq.length - 1] === "space") return; // no double spaces
    }
    lastConfirmRef.current = { letter, ts: Date.now() };
    skipSpeakRef.current = false;
    setConfirmedLetter(letter);
    const now = Date.now();
    if (
      letter !== lastConfirmedSendRef.current.letter ||
      now - lastConfirmedSendRef.current.ts > 300
    ) {
      lastConfirmedSendRef.current = { letter, ts: now };
      sendRoomPayload({ type: "confirmed-letter", letter });
    }
    setLetterSequence((prev) => {
      if (letter === "space" && prev[prev.length - 1] === "space") return prev;
      const next = [...prev, letter];
      letterSequenceRef.current = next;
      return next;
    });
    // Speak confirmed letter once (no repeats) so user hears the confirmation (skip space)
    if (letter !== "space" && autoSpeakRef.current && letter !== lastSpokenLetterRef.current) {
      if (speakingRef.current && typeof window !== "undefined") {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
        speakingRef.current = false;
      }
      speak(letter, true);
      lastSpokenLetterRef.current = letter;
    }
    confirmLockRef.current = letter;
    lastSpokenRef.current = "";
    lastBackendPredictRef.current.nextTs = Date.now() + STABLE_PREDICT_PAUSE_MS;

    if (letter !== "space" && /^[A-Z]$/.test(letter)) {
      const now = Date.now();
      const last = lastTelemetryRef.current;
      if (last.letter !== letter || now - last.ts > 900) {
        lastTelemetryRef.current = { letter, ts: now };
        const confValue = Number.isFinite(detectionConfidence)
          ? Number((detectionConfidence / 100).toFixed(2))
          : null;
        API.post("/api/telemetry/log-prediction", {
          user_id: userIdRef.current,
          predicted_label: letter,
          confidence: confValue,
          latency_ms: null,
          ground_truth: null,
          feedback_consent: false,
        }).catch(() => {
          /* ignore telemetry failures */
        });
      }
    }
  }

  // Remote detection (very light) using remote video
  function handleRemoteInterpret(landmarks) {
    if (!landmarks || !landmarks.length) {
      setRemoteLiveLabel("No hands detected");
      remoteCandidateRef.current = { letter: "", startedAt: 0, lastSeenAt: 0 };
      return;
    }
    const letter = analyzeSingleHandForAlphabet(landmarks[0]);
    if (!allowedLetters.current.has(letter)) {
      setRemoteLiveLabel("Hand detected - show A, B, C, L, I, Y, or O");
      return;
    }
    setRemoteLiveLabel(`Partner letter: ${letter}`);

    const c = remoteCandidateRef.current;
    const now = performance.now();
    if (c.letter !== letter) {
      remoteCandidateRef.current = { letter, startedAt: now, lastSeenAt: now };
    } else {
      const held = now - c.startedAt;
      remoteCandidateRef.current.lastSeenAt = now;
      if (held >= STABLE_MS_PER_LETTER) {
        setRemoteConfirmedLetter(letter);
        setRemoteLetters((prev) => {
          const next = [...prev, letter];
          remoteLetterSeqRef.current = next;
          return next;
        });
        remoteCandidateRef.current = { letter: "", startedAt: 0, lastSeenAt: 0 };
      }
    }
  }

  // ---------------- CHAT / ROOMS ----------------
  function handleSendChat(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    const room = roomRef.current || roomCode.trim();
    setChatMessages((prev) => [...prev, { from: "me", text: msg }]);
    setChatInput("");
    if (socketRef.current && room) {
      try {
        socketRef.current.send(
          JSON.stringify({
            type: "chat",
            room,
            text: msg,
          })
        );
      } catch (err) {
        console.error("Chat send failed", err);
      }
    }
  }

  // ---------------- WEBRTC / SIGNALING ----------------
  function ensureSocket(room) {
    if (socketRef.current) return socketRef.current;
    const targetRoom = room || roomRef.current || "";
    const ws = new WebSocket(`ws://localhost:3000/ws?room=${encodeURIComponent(targetRoom)}`);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("[WebRTC] WS connected", room);
    };

    ws.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload || !payload.type) return;
        console.log("[WebRTC] WS message", payload.type);
        if (payload.type === "offer") {
          await ensurePeerConnection();
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await peerRef.current.createAnswer();
          await peerRef.current.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", sdp: answer, room: targetRoom }));
        } else if (payload.type === "answer") {
          if (!peerRef.current) return;
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } else if (payload.type === "ice-candidate") {
          if (!peerRef.current || !payload.candidate) return;
          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } else if (payload.type === "peer-joined") {
          console.log("[WebRTC] peer joined, creating offer");
          await createAndSendOffer();
        } else if (payload.type === "peer-left") {
          console.log("[WebRTC] peer left");
          setChatMessages([]);  // Clear chat when partner leaves
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          remoteStreamRef.current = null;
          if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
          }
          setRemoteActive(false);
        } else if (payload.type === "chat" && payload.text) {
          setChatMessages((prev) => [...prev, { from: "partner", text: payload.text }]);
          setRemoteLiveLabel("Partner sent a message");
        } else if (payload.type === "live-label") {
          setRemoteLiveLabel(payload.label || "Waiting for partner...");
          setRemoteActive(true);
        } else if (payload.type === "confirmed-letter") {
          setRemoteConfirmedLetter(payload.letter || "");
          setRemoteActive(true);
        } else if (payload.type === "letters") {
          if (Array.isArray(payload.letters)) {
            setRemoteLetters(payload.letters);
            remoteLetterSeqRef.current = payload.letters;
            setRemoteActive(true);
          }
        } else if (payload.type === "clear-letters") {
          setRemoteLetters([]);
          remoteLetterSeqRef.current = [];
          setRemoteConfirmedLetter("");
          setLastSpokenPhrase("");
        }
      } catch (err) {
        console.error("WS message error", err);
      }
    };

    ws.onclose = () => {
      console.log("[WebRTC] WS closed");
      setChatMessages([]);  // Clear chat when connection closes
      socketRef.current = null;
      setRemoteActive(false);
    };

    return ws;
  }

  async function ensurePeerConnection() {
    if (peerRef.current) return peerRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerRef.current = pc;

    pc.onicecandidate = (event) => {
      const room = roomRef.current || roomCode.trim();
      if (event.candidate && socketRef.current && room) {
        console.log("[WebRTC] sending ICE candidate");
        socketRef.current.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: event.candidate,
            room,
          })
        );
      }
    };

    pc.ontrack = (event) => {
      const inboundStream = event.streams && event.streams[0] ? event.streams[0] : null;
      if (inboundStream) {
        remoteStreamRef.current = inboundStream;
      } else {
        if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
        event.track && remoteStreamRef.current.addTrack(event.track);
      }
      if (remoteVideoRef.current && remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        const playPromise = remoteVideoRef.current.play?.();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {/* ignore autoplay errors */});
        }
        setRemoteActive(true);
      }
    };

    // add local tracks if available
    const localStream = localVideoRef.current?.srcObject;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    return pc;
  }

  async function joinRoomAndSignal(code) {
    const room = code.trim().toUpperCase();
    if (!room) return;
    roomRef.current = room;
    setRoomCode(room);
    setRoomJoined(true);
    setMatchStatus(`Joined room ${room}`);

    ensureSocket(room);
    await ensurePeerConnection();
    // if another peer is already there, we'll send an offer on user-joined; else wait
  }

  async function createAndSendOffer() {
    const pc = await ensurePeerConnection();
    const room = roomRef.current || roomCode.trim();
    const socket = ensureSocket(room);
    if (!room) return;
    // ensure local tracks are added before creating offer
    const localStream = localVideoRef.current?.srcObject;
    if (localStream) {
      const senders = pc.getSenders();
      localStream.getTracks().forEach((track) => {
        const already = senders.find((s) => s.track && s.track.id === track.id);
        if (!already) {
          pc.addTrack(track, localStream);
        }
      });
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("[WebRTC] socket not ready, cannot send offer");
      return;
    }
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log("[WebRTC] sending offer");
    socket.send(
      JSON.stringify({
        type: "offer",
        sdp: offer,
        room,
      })
    );
  }

  async function handleCreateRoom() {
    try {
      const res = await fetch(`${API_ORIGIN}/create-room`);
      const data = await res.json();
      if (data.room) {
        await joinRoomAndSignal(data.room);
      }
    } catch (err) {
      console.error("Error creating room:", err);
    }
  }

  async function handleJoinRoom(codeArg) {
    const code = (codeArg || roomCode || "").trim();
    if (!code) return;
    if (!isCameraOn) {
      try {
        await startCamera();
      } catch (err) {
        console.error("Auto-start camera failed", err);
      }
    }
    await joinRoomAndSignal(code);
  }

  function handleLeaveRoom() {
    setRoomJoined(false);
    setMatchStatus("Live detection");
    setChatMessages([]);  // Clear chat when leaving
    if (peerRef.current) {
      console.log("[WebRTC] closing peer connection");
      peerRef.current.close();
      peerRef.current = null;
    }
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        /* ignore */
      }
      console.log("[WebRTC] socket closed");
      socketRef.current = null;
    }
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    roomRef.current = "";
  }

  function copyRoomCode() {
    const code = (roomCode || "").trim();
    if (!code || !navigator?.clipboard) return;
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopyMsg("Copied!");
        setTimeout(() => setCopyMsg(""), 1200);
      })
      .catch((err) => {
        console.error("Clipboard copy failed", err);
      });
  }

  // ---------------- MOUNT / UNMOUNT ----------------
  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(false);

    return () => {
      isMountedRef.current = false;
      stopCamera();
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          /* ignore */
        }
        socketRef.current = null;
      }
      if (detectionRafRef.current != null) cancelAnimationFrame(detectionRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- RENDER ----------------

  if (isLoading) {
    return (
      <div className="app-shell text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-300">Loading Interpreter Session...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app-shell text-slate-50 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-400">{loadError}</p>
        <button
          onClick={() => navigate("/home")}
          className="btn-secondary px-4 py-2 rounded text-sm"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell interpreter-shell text-slate-50 flex flex-col">
      {/* Header */}
      <header className="app-header px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-50 isolate">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Interpreter Session</h1>
            <div className="relative z-50">
              <button
                type="button"
                onClick={() => setShowInfo((prev) => !prev)}
                className="w-7 h-7 rounded-full border border-white/15 bg-white/5 text-slate-200 text-sm hover:bg-white/10"
                aria-label="Interpreter info"
              >
                &#x22EE;
              </button>
              {showInfo && (
                <div className="absolute left-1/2 top-[calc(100%+10px)] -translate-x-1/2 w-[320px] rounded-xl border border-emerald-400/40 bg-slate-950/95 p-3 text-sm text-white leading-relaxed shadow-[0_18px_50px_rgba(5,15,20,0.85)] ring-1 ring-emerald-400/20 z-[200]">
                  Real-time ASL alphabet interpretation. Hold a steady gesture for about 1.7 seconds
                  to confirm the letter. Auto-speak reads the phrase when your hand is lowered for
                  ~0.85 seconds.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/home")}
            className="btn-ghost px-4 py-2 rounded text-sm"
          >
            Back to Home
          </button>
        </div>
      </header>

      {/* Main grid */}
      <main className="fade-up flex-1 max-w-[1600px] w-full mx-auto flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-6 h-full min-h-[800px]">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full flex-1">
          
          {/* LEFT: YOU & PARTNER VIDEOS (Takes 8 columns) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-[500px]">
                {/* YOU CARD */}
                <div className="surface-card flex flex-col overflow-hidden rounded-2xl relative shadow-[0_8px_30px_rgba(0,0,0,0.2)] border-white/10 group">
                   {/* Header */}
                   <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/20 z-10">
                     <div className="flex items-center gap-3">
                       <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse"></div>
                       <h2 className="text-sm font-bold tracking-wide uppercase text-white">You</h2>
                     </div>
                     <div className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-emerald-400/90 bg-emerald-400/10 px-2 py-1.5 rounded-md border border-emerald-500/20 uppercase tracking-wide">
                          Detection: {detectionConfidence}%
                        </span>
                     </div>
                   </div>

                   {/* Video Area */}
                   <div className="relative flex-1 bg-gradient-to-b from-slate-900 to-black flex flex-col overflow-hidden">
                     <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover opacity-80"
                        style={{ transform: "scaleX(-1)" }}
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 pointer-events-none"
                      />
                      {/* Video Overlays */}
                      <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col justify-end transition-opacity">
                         <div className="flex items-end justify-between">
                            <div>
                               <p className="text-[11px] text-emerald-400/80 uppercase tracking-widest font-semibold mb-1">Live Sign</p>
                               <p className="text-2xl sm:text-3xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{localLabel}</p>
                            </div>
                            {confirmedLetter && (
                              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 backdrop-blur-md flex items-center justify-center shadow-[0_8px_32px_rgba(52,211,153,0.3)]">
                                 <span className="text-3xl sm:text-4xl font-bold text-emerald-300 drop-shadow-md">{confirmedLetter}</span>
                              </div>
                            )}
                         </div>
                      </div>
                      {!isCameraOn && (
                         <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20">
                            <button onClick={startCamera} className="btn-primary px-6 py-3 rounded-xl shadow-[0_8px_20px_rgba(52,211,153,0.3)] hover:scale-105 transition-all flex items-center gap-2 font-medium">
                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                               Turn On Camera
                            </button>
                         </div>
                      )}
                   </div>

                   {/* Footer / Controls */}
                   <div className="p-4 sm:p-5 bg-slate-900/80 border-t border-white/5 flex flex-col gap-4 backdrop-blur-md z-10">
                      <div className="flex items-center justify-between bg-black/40 rounded-xl p-3 border border-white/5">
                         <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Message</span>
                            <span className="text-emerald-300 font-mono text-lg leading-none break-words">{letterSequence.map((letter, i) => letter === "" ? " " : letter).join("") || <span className="opacity-30">...</span>}</span>
                         </div>
                      </div>
                      <div className="flex items-center justify-between">
                         <label className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-white cursor-pointer transition-colors select-none group-hover:opacity-100">
                           <div className="relative flex items-center justify-center">
                             <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} className="peer sr-only" />
                             <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                           </div>
                           <span className="font-medium text-xs tracking-wide">Auto-speak</span>
                         </label>
                         
                         <div className="flex items-center gap-2">
                           {isCameraOn && (
                              <button onClick={stopCamera} className="px-3.5 py-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors text-xs font-semibold">Stop</button>
                           )}
                           <button onClick={() => speakLettersThenPhrase(letterSequence, true)} className="px-3.5 py-2 rounded-lg bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white border border-white/10 transition-colors text-xs font-semibold shadow-sm">Speak</button>
                           <button onClick={addSpace} className="px-3.5 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors text-xs font-semibold" title="Add space (Spacebar)">Space</button>
                           <button onClick={() => {
                              resetSpeechState({
                                 setLetterSequence,
                                 setConfirmedLetter,
                                 lastSpokenRef,
                                 candidateRef,
                                 frameHistory,
                                 labelHistory,
                                 noDetectionTimeout,
                                 skipSpeakRef,
                                 speakingRef,
                                 letterSequenceRef,
                                 lastAutoSpokenPhraseRef,
                                 pendingAutoSpeakRef,
                              });
                              sendRoomPayload({ type: "clear-letters" });
                           }} className="px-3.5 py-2 rounded-lg bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white border border-white/10 transition-colors text-xs font-semibold shadow-sm">Clear</button>
                         </div>
                      </div>
                   </div>
                </div>

                {/* PARTNER CARD */}
                <div className="surface-card flex flex-col overflow-hidden rounded-2xl relative shadow-[0_8px_30px_rgba(0,0,0,0.2)] border-white/10 group">
                   {/* Header */}
                   <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/20 z-10">
                     <div className="flex items-center gap-3">
                       <div className={`w-2.5 h-2.5 rounded-full ${remoteActive ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.5)]'}`}></div>
                       <h2 className="text-sm font-bold tracking-wide uppercase text-white">Partner</h2>
                     </div>
                     {roomJoined && (
                        <div className="flex items-center gap-2">
                           <span className="text-[11px] font-mono font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-500/20 shadow-inner">
                             {roomCode}
                           </span>
                           <button onClick={copyRoomCode} className="relative p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition-colors" title="Copy Room Code">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              {copyMsg && <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-medium text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap shadow-lg">{copyMsg}</span>}
                           </button>
                        </div>
                     )}
                   </div>

                   {/* Partner Video Area */}
                   <div className="relative flex-1 bg-gradient-to-b from-slate-900 to-black flex flex-col overflow-hidden">
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${remoteActive ? "opacity-80" : "opacity-0"}`}
                        style={{ transform: "scaleX(-1)" }}
                      />
                      
                      {remoteActive && (
                        <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col justify-end z-20">
                           <div className="flex items-end justify-between">
                              <div>
                                 <p className="text-[11px] text-emerald-400/80 uppercase tracking-widest font-semibold mb-1">Live Sign</p>
                                 <p className="text-2xl sm:text-3xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{remoteLiveLabel}</p>
                              </div>
                              {remoteConfirmedLetter && (
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 backdrop-blur-md flex items-center justify-center shadow-[0_8px_32px_rgba(52,211,153,0.3)]">
                                   <span className="text-3xl sm:text-4xl font-bold text-emerald-300 drop-shadow-md">{remoteConfirmedLetter}</span>
                                </div>
                              )}
                           </div>
                        </div>
                      )}
                      
                      {!roomJoined && (
                         <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-30 p-6 sm:p-8">
                            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-5 border border-emerald-500/20 shadow-[0_0_30px_rgba(52,211,153,0.15)]">
                              <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-1 tracking-wide">Connect with Partner</h3>
                            <p className="text-xs text-slate-400 text-center mb-6">Start a call to see remote signs</p>
                            <div className="flex flex-col gap-3 w-full max-w-[260px]">
                               <button onClick={handleCreateRoom} className="btn-primary w-full py-3 rounded-xl shadow-[0_8px_20px_rgba(52,211,153,0.25)] hover:scale-[1.02] transition-all font-medium text-sm">Create New Room</button>
                               <div className="flex items-center gap-3 my-1 opacity-60">
                                  <div className="h-px bg-white/20 flex-1"></div>
                                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">or</span>
                                  <div className="h-px bg-white/20 flex-1"></div>
                                </div>
                               <div className="flex flex-col gap-2.5">
                                  <input type="text" value={roomCode} onChange={e => setRoomCode(e.target.value)} placeholder="Enter Room Code" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all text-center tracking-wide" />
                                  <button onClick={() => handleJoinRoom()} disabled={!roomCode.trim()} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed">Join Room</button>
                               </div>
                            </div>
                         </div>
                      )}

                      {roomJoined && !remoteActive && (
                         <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-30 p-6 text-center">
                            <div className="relative w-16 h-16 mb-6">
                               <div className="absolute inset-0 rounded-full border-2 border-slate-700"></div>
                               <div className="absolute inset-0 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
                               <div className="absolute inset-0 flex items-center justify-center">
                                 <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                               </div>
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Waiting for partner</h3>
                            <p className="text-sm text-slate-400 flex items-center gap-2">
                               Share code: 
                               <span className="font-mono text-emerald-300 bg-emerald-950/50 px-2.5 py-1 rounded border border-emerald-500/20">{roomCode}</span>
                            </p>
                         </div>
                      )}
                   </div>
                   
                   {/* Partner Footer */}
                   <div className="p-4 sm:p-5 bg-slate-900/80 border-t border-white/5 flex flex-col gap-4 backdrop-blur-md z-10">
                      <div className="flex items-center justify-between bg-black/40 rounded-xl p-3 border border-white/5">
                         <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Message</span>
                            <span className="text-emerald-300 font-mono text-lg leading-none">{remoteLetters.join("") || <span className="opacity-30">...</span>}</span>
                         </div>
                      </div>
                      <div className="flex items-center justify-between">
                         <label className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-white cursor-pointer transition-colors select-none group-hover:opacity-100">
                           <div className="relative flex items-center justify-center">
                             <input type="checkbox" checked={remoteAutoSpeak} onChange={(e) => setRemoteAutoSpeak(e.target.checked)} className="peer sr-only" />
                             <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                           </div>
                           <span className="font-medium text-xs tracking-wide">Auto-speak</span>
                         </label>
                         
                         <div className="flex items-center gap-2">
                           {roomJoined && (
                              <button onClick={handleLeaveRoom} className="px-3.5 py-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors text-xs font-semibold">Leave</button>
                           )}
                           <button onClick={() => speakLettersThenPhrase(remoteLetters, true)} className="px-3.5 py-2 rounded-lg bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white border border-white/10 transition-colors text-xs font-semibold shadow-sm">Speak</button>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* RIGHT: CHAT (Takes 4 columns) */}
          <div className="lg:col-span-4 h-[600px] lg:h-auto flex flex-col">
             <div className="surface-card flex flex-col h-full overflow-hidden rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] border-white/10">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/20 z-10">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      </div>
                      <h2 className="text-sm font-bold tracking-wide uppercase text-white">Live Chat</h2>
                   </div>
                   <span className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full ${roomJoined ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]' : 'bg-slate-800 text-slate-400 border border-white/5'}`}>
                      {roomJoined ? 'Connected' : 'Offline'}
                   </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gradient-to-b from-slate-900/60 to-slate-950/80">
                   {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                         <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center">
                            <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                         </div>
                         <p className="text-sm font-medium">No messages yet.</p>
                      </div>
                   ) : (
                      chatMessages.map((msg, i) => (
                         <div key={i} className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"} animate-[fadeUp_0.3s_ease_both]`}>
                            <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm shadow-md ${msg.from === "me" ? "bg-emerald-500 text-emerald-950 rounded-br-sm font-medium" : "bg-slate-800 border border-white/5 text-slate-100 rounded-bl-sm"}`}>
                               {msg.text}
                            </div>
                         </div>
                      ))
                   )}
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (typeof handleSendChat === 'function') handleSendChat(e);
                }} className="p-4 sm:p-5 bg-black/40 border-t border-white/5 backdrop-blur-md">
                   <div className="relative flex items-center">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder={roomJoined ? "Type your message..." : "Join a room to chat"}
                        disabled={!roomJoined}
                        className="w-full bg-slate-900/80 border border-white/10 rounded-full pl-5 pr-14 py-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-all disabled:opacity-40 shadow-inner"
                      />
                      <button type="submit" disabled={!roomJoined || !chatInput.trim()} className="absolute right-2 w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400 hover:scale-105 transition-all disabled:opacity-30 disabled:hover:scale-100 shadow-[0_4px_12px_rgba(52,211,153,0.3)] disabled:shadow-none">
                         <svg className="w-4 h-4 translate-x-[1px] translate-y-[-1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                   </div>
                </form>
             </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer-min mt-2 pt-4 text-xs font-medium tracking-wider text-center opacity-60">
          GESTURA 2025
        </footer>
      </main>

    </div>
  );
}
