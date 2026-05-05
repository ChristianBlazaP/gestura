import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import { getTokenRole } from "../lib/auth";

export default function LoginPage() {
  const [loginForm, setLoginForm] = useState({
    loginId: "",
    password: "",
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const loginUser = async (e) => {
    e.preventDefault();
    setErr("");
    if (!loginForm.loginId.trim() || !loginForm.password) {
      setErr("Enter your username/email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await API.post("/auth/login", {
        username: loginForm.loginId.trim(),
        email: loginForm.loginId.trim(),
        password: loginForm.password,
      });
      const { token } = res.data;
      localStorage.setItem("token", token);

      const role = getTokenRole();
      nav(role === "admin" ? "/admin" : "/home");
    } catch (error) {
      setErr(error.response?.data?.error || "Login failed. Please try again.");
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
            <h1 className="mt-4 text-2xl font-semibold text-emerald-900">WELCOME TO GESTURA!</h1>
            <p className="mt-1 text-sm text-emerald-800">"The most important thing in communication is hearing what isn't said."</p>
          </div>

          <form onSubmit={loginUser} className="px-8 pb-8 pt-4">
            {err && (
              <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>
            )}

            <label className="block text-sm font-semibold text-emerald-950 mb-1">Username or Email</label>
            <input
              className="w-full mb-4 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              placeholder="you@example.com or username"
              name="username"
              value={loginForm.loginId}
              onChange={(e) => setLoginForm({ ...loginForm, loginId: e.target.value })}
              type="text"
            />

            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-emerald-950">Password</label>
              <Link to="/forgot-password" className="text-sm text-emerald-700 hover:underline font-medium">Forgot password?</Link>
            </div>
            <input
              className="w-full mb-5 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              type="password"
              placeholder="Your password"
              name="password"
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            />



            <button
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 text-sm font-semibold rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <p className="mt-3 text-[11px] text-emerald-800 text-center">
              Admin accounts go directly to the Admin Dashboard after sign in.
            </p>

            <div className="mt-4 text-sm text-center">
              <span className="text-emerald-900">Don't have an account? </span>
              <Link to="/register" className="text-emerald-700 hover:underline">Create account</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
