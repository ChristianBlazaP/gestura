import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../services/api";

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing or invalid.");
      return;
    }

    const run = async () => {
      try {
        const res = await API.get("/auth/verify-email", { params: { token } });
        if (res.data?.message) {
          setMessage(res.data.message);
        } else {
          setMessage("Email verified successfully.");
        }
        setStatus("success");
      } catch (err) {
        const msg =
          err.response?.data?.error || "Verification failed. The link may be invalid or expired.";
        setMessage(msg);
        setStatus("error");
      }
    };
    run();
  }, [location.search]);

  const goLogin = () => navigate("/login");
  const goHome = () => navigate("/home");

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl shadow-black/30 text-slate-100">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-emerald-600/20 border border-emerald-500/50 text-emerald-300 flex items-center justify-center mx-auto font-bold">
            GS
          </div>
          <h1 className="text-xl font-semibold">Email Verification</h1>
          <p className="text-sm text-slate-400">
            {status === "loading" && "Please wait while we verify your email..."}
            {status !== "loading" && message}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {status === "success" ? (
            <>
              <button
                onClick={goLogin}
                className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold"
              >
                Continue to sign in
              </button>
              <button
                onClick={goHome}
                className="w-full px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-100"
              >
                Go to home
              </button>
            </>
          ) : status === "error" ? (
            <>
              <button
                onClick={goLogin}
                className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold"
              >
                Back to sign in
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
