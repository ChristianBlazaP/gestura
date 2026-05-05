import { Link, useNavigate } from "react-router-dom";
import { getTokenRole } from "../lib/auth";
import demoVideo from "../assets/dem.mp4?url";

export default function HomePage() {
  const nav = useNavigate();
  const role = getTokenRole() || "user";
  const isAdmin = role === "admin";

  const logout = () => {
    if (!window.confirm("Are you sure you want to logout?")) return;
    localStorage.removeItem("token");
    nav("/");
  };

  return (
    <div className="app-shell text-white">
      <header className="app-header sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold tracking-wide">GESTURA</div>
            <span
              className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${
                isAdmin
                  ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                  : "border-slate-500/40 bg-slate-700/30 text-slate-200"
              }`}
            >
              {role}
            </span>
          </div>

          <nav className="flex items-center gap-8 text-sm">
            <Link to="/home" className="nav-link nav-link-active">
              Home
            </Link>
            <Link to="/interpreter" className="nav-link">
              Interpreter
            </Link>
            <Link to="/learnings" className="nav-link">
              Learnings
            </Link>
            <Link to="/profile" className="nav-link">
              Profile
            </Link>
            {isAdmin && (
              <Link to="/admin" className="nav-link">
                Admin
              </Link>
            )}
            <button onClick={logout} className="nav-link">
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-14 relative">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center fade-up">
          <div className="space-y-6">
            <span className="hero-kicker">Inclusive communication</span>
            <h1 className="hero-title text-5xl md:text-6xl leading-tight">
              Gesture AI for Everyone
            </h1>
            <p className="hero-subtitle max-w-xl">
              Turn hand gestures into meaningful text and audio across web and mobile.
              Built for clarity, accessibility, and real-time communication in your community.
            </p>
            {/* <div className="flex flex-wrap gap-3">
              <span className="stat-chip">Real-time interpretation</span>
              <span className="stat-chip">Web-based access</span>
              <span className="stat-chip">ASL alphabet focus</span>
            </div> */}
            <div className="flex flex-wrap gap-4 pt-2">
              <Link to="/interpreter" className="btn-primary px-5 py-2.5 rounded-lg">
                Open Interpreter
              </Link>
              <Link to="/learnings" className="btn-secondary px-5 py-2.5 rounded-lg">
                Browse Learnings
              </Link>
            </div>
          </div>

          <div className="surface-card-strong overflow-hidden h-[340px] md:h-[380px] relative">
            <video
              src={demoVideo}
              controls
              autoPlay
              loop
              muted
              playsInline
              preload="none"
              poster="/bg.jpg"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="surface-card p-6 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              Accessible
            </p>
            <h3 className="text-lg font-semibold">Designed for daily use</h3>
            <p className="text-sm text-slate-300">
              Clear layouts, large controls, and visual feedback reduce confusion
              for first-time users.
            </p>
          </div>
          <div className="surface-card p-6 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              Practical
            </p>
            <h3 className="text-lg font-semibold">Focus on static handshapes</h3>
            <p className="text-sm text-slate-300">
              Optimized for reliable alphabet detection in real-world lighting
              and camera positions.
            </p>
          </div>
          <div className="surface-card p-6 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              Community
            </p>
            <h3 className="text-lg font-semibold">Supports local learning</h3>
            <p className="text-sm text-slate-300">
              Built to help schools and community groups document feedback and
              track adoption.
            </p>
          </div>
        </section>

        <section className="mt-12 flex justify-center fade-up">
          <div className="surface-card p-8 text-center max-w-4xl">
            <p className="text-gray-200 leading-relaxed text-lg md:text-xl">
              To our mute, hard-of-hearing, and speech-impaired community: your voice is
              felt in every gesture and every glance. Gestura exists to listen with you,
              carry your words across any gap, and make every space more welcoming. Thank
              you for trusting us to learn from your hands and hearts as we build a kinder
              world together.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer-min py-6 text-center text-sm">
        Ac 2025 GESTURA
      </footer>
    </div>
  );
}
