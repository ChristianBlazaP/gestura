import { Link, useNavigate } from "react-router-dom";

export default function ResourcesPage() {
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
        <div className="grid md:grid-cols-3 gap-8">
          <aside className="md:col-span-1 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <button key={i} className="w-full text-left px-4 py-3 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition">List item {i + 1}</button>
            ))}
          </aside>
          <section className="md:col-span-2 rounded-2xl border border-white/15 bg-white/5 p-6 min-h-[18rem]">
            <div className="text-gray-300">Preview / description shown here</div>
          </section>
        </div>
      </main>
    </div>
  );
}
