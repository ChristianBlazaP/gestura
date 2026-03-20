import { Link, useNavigate } from "react-router-dom";

export default function DescriptionPage() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-white">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => nav(-1)} className="px-3 py-1.5 rounded-lg border border-white/15 text-sm text-gray-300 hover:text-white hover:bg-white/10">Back</button>
            <div className="font-bold tracking-wide">GESTURA</div>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/home" className="text-gray-300 hover:text-white">Home</Link>
            <Link to="/interpreter" className="text-gray-300 hover:text-white">Interpreter</Link>
            <Link to="/learnings" className="text-gray-300 hover:text-white">Learnings</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-2xl border border-white/15 bg-white/5 p-6 min-h-[12rem] mb-6">
          <div className="text-gray-300">give description here</div>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          <button className="rounded-xl border border-white/15 bg-white/5 p-6 text-left hover:bg-white/10 transition">Saved gesture actions</button>
          <button className="rounded-xl border border-white/15 bg-white/5 p-6 text-left hover:bg-white/10 transition">Make a gesture action</button>
          <button className="rounded-xl border border-white/15 bg-white/5 p-6 text-left hover:bg-white/10 transition">Action selector</button>
        </div>
      </main>
    </div>
  );
}
