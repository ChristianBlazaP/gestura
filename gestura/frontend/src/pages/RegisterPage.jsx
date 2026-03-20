import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import API from "../services/api";

export default function RegisterPage() {
  const [registerForm, setRegisterForm] = useState({
    firstname: "",
    lastname: "",
    middlename: "",
    suffix: "",
    username: "",
    role: "user",
    admin_code: "",
    email: "",
    password: "",
  });
  const [emailWarning, setEmailWarning] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const registerUser = async (e) => {
    e.preventDefault();

    const { firstname, lastname, username, email, password } = registerForm;
    if (!firstname.trim() || !lastname.trim() || !username.trim() || !email.trim() || !password) {
      setErr("Please fill in all required fields.");
      return;
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    setEmailWarning(emailValid ? "" : "Please use a real email address to receive updates.");
    if (!emailValid) {
      setErr("Enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    const wantsAdmin = registerForm.role === "admin";
    if (wantsAdmin && !registerForm.admin_code.trim()) {
      setErr("Admin access code is required for admin registration.");
      return;
    }

    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const payload = {
        ...registerForm,
        role: wantsAdmin ? "admin" : "user",
        admin_code: wantsAdmin ? registerForm.admin_code.trim() : undefined,
      };
      if (!wantsAdmin) delete payload.admin_code;

      const res = await API.post("/auth/register", {
        ...payload,
        firstname: registerForm.firstname.trim(),
        middlename: registerForm.middlename.trim(),
        lastname: registerForm.lastname.trim(),
        username: registerForm.username.trim(),
        email: registerForm.email.trim().toLowerCase(),
      });
      setMsg(res.data.message);
      setTimeout(() => {
        nav("/");
      }, 1500);
    } catch (error) {
      setErr(error.response?.data?.error || "Registration failed. Please try again.");
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
            <h1 className="mt-4 text-2xl font-semibold text-emerald-900">Create your account</h1>
            <p className="mt-1 text-sm text-emerald-800">Join us and start exploring the dashboard.</p>
          </div>

          <form onSubmit={registerUser} className="px-8 pb-8 pt-4">
            {err && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>}
            {msg && <div className="mb-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{msg}</div>}

            <label className="block text-sm font-semibold text-emerald-950 mb-1">Firstname</label>
            <input
              className="w-full mb-4 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              placeholder="Firstname"
              name="firstname"
              onChange={(e) => setRegisterForm({ ...registerForm, firstname: e.target.value })}
              type="text"
            />

            <label className="block text-sm font-semibold text-emerald-950 mb-1">Middlname</label>
            <input
              className="w-full mb-4 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              placeholder="Middlename (optional)"
              name="middlename"
              onChange={(e) => setRegisterForm({ ...registerForm, middlename: e.target.value })}
              type="text"
            />

            <label className="block text-sm font-semibold text-emerald-950 mb-1">Lastname</label>
            <input
              className="w-full mb-4 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              placeholder="Lastname"
              name="lastname"
              onChange={(e) => setRegisterForm({ ...registerForm, lastname: e.target.value })}
              type="text"
            />

            <label className="block text-sm font-semibold text-emerald-950 mb-1">Suffix</label>
            <select
              className="w-full mb-4 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              name="suffix" 
              onChange={(e) => setRegisterForm({ ...registerForm, suffix: e.target.value })}
              >
              <option value="">Select suffix (optional)</option>
              <option value="Jr.">Jr.</option>
              <option value="Sr.">Sr.</option>
              <option value="III">III</option>
              <option value="IV">IV</option>
            </select>

            <label className="block text-sm font-semibold text-emerald-950 mb-1">Username</label>
            <input
              className="w-full mb-4 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              placeholder="Choose a username"
              name="username"
              onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
              type="text"
            />

            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-emerald-950">Email</label>
              {emailWarning && <span className="text-[11px] text-amber-600 font-medium">{emailWarning}</span>}
            </div>
            <input
              className="w-full mb-4 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              placeholder="you@example.com"
              onChange={(e) => {
                const value = e.target.value;
                setRegisterForm({ ...registerForm, email: value });
                const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
                setEmailWarning(valid ? "" : "Please use a real email address to receive updates.");
              }}
              type="email"
              autoComplete="email"
            />

            <label className="block text-sm font-semibold text-emerald-950 mb-1">Password</label>
            <input
              className="w-full mb-4 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
              type="password"
              placeholder="Create a password"
              onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
              autoComplete="new-password"
            />

            <div className="mb-4 space-y-2">
              <label className="flex items-center gap-2 text-sm text-emerald-900">
                <input
                  type="checkbox"
                  checked={registerForm.role === "admin"}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      role: e.target.checked ? "admin" : "user",
                    })
                  }
                />
                Register as school admin (requires access code)
              </label>
              {registerForm.role === "admin" && (
                <div>
                  <label className="block text-sm font-semibold text-emerald-950 mb-1">
                    Admin access code
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-emerald-200 text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white/90 shadow-sm"
                    placeholder="Provided by the school"
                    value={registerForm.admin_code}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, admin_code: e.target.value })
                    }
                    type="password"
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-emerald-700 mt-1">
                    Ask your school admin for the code.
                  </p>
                </div>
              )}
            </div>

            <button
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 text-sm font-semibold rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>

            <div className="mt-4 text-sm text-center">
              <span className="text-emerald-900">Already have an account? </span>
              <Link to="/" className="text-emerald-700 hover:underline">Back to sign in</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
