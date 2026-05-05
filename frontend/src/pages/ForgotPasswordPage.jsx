import { useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErr("Please enter your email");
      return;
    }
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    if (!valid) {
      setErr("Please use a real email so we can send the reset link.");
      return;
    }
    try {
      setLoading(true);
      const res = await API.post("/auth/password-reset/request", { email: cleanEmail });
      if (res.data?.error) {
        setErr(res.data.error);
      } else {
        setMsg(res.data?.message || "If an account exists, a reset email has been sent.");
      }
    } catch (error) {
      setErr(error.response?.data?.error || error.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-emerald-50/85 backdrop-blur-md rounded-2xl shadow-xl border border-emerald-200 overflow-hidden">
          <div className="px-8 pt-8 pb-2 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 font-bold">GS</div>
            <h1 className="mt-4 text-2xl font-semibold text-emerald-900">Forgot password</h1>
            <p className="mt-1 text-sm text-emerald-800">Use your primary or recovery email to receive a reset link.</p>
          </div>

          <form onSubmit={submit} className="px-8 pb-8 pt-4">
            {err && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>}
            {msg && <div className="mb-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{msg}</div>}

            <label className="block text-sm font-semibold text-emerald-950 mb-1">Email</label>
            <input
              className="w-full mb-4 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
            />

            <button
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 text-sm font-semibold rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>

            <div className="mt-4 text-sm text-center">
              <Link to="/" className="text-emerald-700 hover:underline">Back to sign in</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
