import axios from "axios";

const API_BASE = "http://localhost:5000"; // change for deployment

export async function requestAslPrediction({
  landmarks,
  fallbackLetter,
  hybridConfidence,
}) {
  try {
    const res = await axios.post(`${API_BASE}/api/predict`, {
      landmarks,
      fallbackLetter,
      hybridConfidence,
    });
    return res.data;
  } catch (err) {
    console.error("❌ Error calling /api/predict:", err);
    return { ok: false, error: err.message };
  }
}