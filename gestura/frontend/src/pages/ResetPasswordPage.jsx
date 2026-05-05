import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import API from "../services/api";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initialToken = params.get("token") || "";
    setToken(initialToken);
  }, [location.search]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!token.trim()) {
      setErr("Missing or invalid reset token.");
      return;
    }
    if (!password || password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const res = await API.post("/auth/password-reset/confirm", {
        token: token.trim(),
        newPassword: password,
      });
      setMsg(res.data?.message || "Password reset successful.");
      setTimeout(() => navigate("/login"), 1400);
    } catch (error) {
      setErr(error.response?.data?.error || error.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-emerald-50/85 backdrop-blur-md rounded-2xl shadow-xl border border-emerald-200 overflow-hidden">
          <div className="px-8 pt-8 pb-2 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 font-bold">
              GS
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-emerald-900">
              Reset password
            </h1>
            <p className="mt-1 text-sm text-emerald-800">
              Choose a new password to finish resetting your account.
            </p>
          </div>

          <form onSubmit={submit} className="px-8 pb-8 pt-4 space-y-3">
            {err && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {err}
              </div>
            )}
            {msg && (
              <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                {msg}
              </div>
            )}

            <label className="block text-sm font-semibold text-emerald-950">
              Reset token
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste the token from your email"
            />

            <label className="block text-sm font-semibold text-emerald-950">
              New password
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            <label className="block text-sm font-semibold text-emerald-950">
              Confirm password
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm your password"
            />

            <button
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 text-sm font-semibold rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-md mt-2"
            >
              {loading ? "Resetting..." : "Save new password"}
            </button>

            <div className="text-sm text-center pt-1">
              <Link to="/login" className="text-emerald-700 hover:underline">
                Back to sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
