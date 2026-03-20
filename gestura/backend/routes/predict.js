const express = require("express");
const { spawn } = require("child_process");
const path = require("path");

const router = express.Router();
const REQUEST_TIMEOUT_MS = 1500;

// Path to Python executable (use your ASL venv if available)
const PYTHON_BIN =
  process.env.PREDICT_PYTHON_PATH ||
  "C:\\\\Users\\\\admin\\\\Downloads\\\\datasets\\\\.venv\\\\Scripts\\\\python.exe";
const SCRIPT_PATH = path.join(__dirname, "..", "predict_cli.py");
const WORKER_PATH = path.join(__dirname, "..", "predict_worker.py");

let worker = null;
let workerBuffer = "";
let seq = 0;
const pending = new Map();

function startWorker() {
  if (worker) return worker;
  worker = spawn(PYTHON_BIN, ["-u", WORKER_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  worker.stdout.on("data", (chunk) => {
    workerBuffer += chunk.toString();
    let idx;
    while ((idx = workerBuffer.indexOf("\n")) >= 0) {
      const line = workerBuffer.slice(0, idx).trim();
      workerBuffer = workerBuffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        const id = msg.id;
        if (pending.has(id)) {
          const { resolve } = pending.get(id);
          pending.delete(id);
          resolve(msg);
        }
      } catch {
        // ignore parse errors
      }
    }
  });

  worker.stderr.on("data", (chunk) => {
    // keep stderr for debugging, but do not crash server
    console.error("[predict_worker]", chunk.toString().trim());
  });

  worker.on("exit", () => {
    worker = null;
    // reject all pending promises
    for (const { reject } of pending.values()) {
      reject(new Error("worker_exited"));
    }
    pending.clear();
  });

  return worker;
}

// Prewarm worker on startup to avoid first-request latency spikes.
try {
  startWorker();
} catch (err) {
  console.warn("predict worker prewarm failed:", err);
}

router.post("/", (req, res) => {
  const { features } = req.body || {};
  if (!Array.isArray(features) || features.length !== 63) {
    return res.status(400).json({ error: "features must be an array of length 63" });
  }

  // Prefer a long-lived worker to avoid per-request Python startup cost
  try {
    startWorker();
  } catch (err) {
    // fallback to per-request mode if worker fails
  }

  if (worker) {
    const id = ++seq;
    const payload = JSON.stringify({ id, features }) + "\n";
    const timeout = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        try {
          worker?.kill();
        } catch {
          // ignore
        }
        worker = null;
        workerBuffer = "";
        pending.clear();
        return res.status(504).json({ error: "predict_timeout" });
      }
    }, REQUEST_TIMEOUT_MS);

    pending.set(id, {
      resolve: (msg) => {
        clearTimeout(timeout);
        if (msg.error) return res.status(500).json({ error: msg.error });
        return res.json(msg);
      },
      reject: () => {
        clearTimeout(timeout);
        return res.status(500).json({ error: "predict_failed" });
      },
    });

    worker.stdin.write(payload);
    return;
  }

  // Fallback: spawn per request
  const py = spawn(PYTHON_BIN, [SCRIPT_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let out = "";
  let err = "";

  py.stdout.on("data", (d) => (out += d.toString()));
  py.stderr.on("data", (d) => (err += d.toString()));

  py.on("close", (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: "infer_failed", detail: err || `code ${code}` });
    }
    try {
      const parsed = JSON.parse(out);
      return res.json(parsed);
    } catch (e) {
      return res.status(500).json({ error: "bad_response", detail: out || err });
    }
  });

  // Send JSON input to python
  py.stdin.write(JSON.stringify({ features }));
  py.stdin.end();
});

module.exports = router;
