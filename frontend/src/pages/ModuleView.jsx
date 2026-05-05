// src/pages/ModuleView.jsx
import { useParams, Link, useNavigate } from "react-router-dom";

const modules = {
  "letters-basic": {
    title: "Alphabet Module: A, B, C, L, I, Y, O",
    subtitle: "Learn the static handshapes used by Gestura's current model.",
    description:
      "This module focuses on the seven letters currently supported by the system: A, B, C, L, I, Y, and O. Each letter is shown as a static handshape. Learners should focus on clear finger positions, palm orientation, and consistent framing in front of the camera.",

    letters: [
      {
        id: "A",
        label: "Letter A",
        notes:
          "Closed fist with thumb resting on the side. Make sure fingers curl tightly and thumb is visible from the front.",
      },
      {
        id: "B",
        label: "Letter B",
        notes:
          "Fingers extended and together, thumb across the palm. Palm facing forward, hand relaxed but straight.",
      },
      {
        id: "C",
        label: "Letter C",
        notes:
          "Hand forms a 'C' shape, as if holding a cup. Keep the curve smooth and visible from the camera angle.",
      },
      {
        id: "L",
        label: "Letter L",
        notes:
          "Index finger pointing up, thumb pointing sideways like a gun shape. Other fingers folded down.",
      },
      {
        id: "I",
        label: "Letter I",
        notes:
          "Little finger extended, other fingers folded into the palm. Keep the pinky straight and clear.",
      },
      {
        id: "Y",
        label: "Letter Y",
        notes:
          "Thumb and little finger extended, other three fingers folded. Rotate slightly so both extended fingers are visible.",
      },
      {
        id: "O",
        label: "Letter O",
        notes:
          "Fingers and thumb form a round 'O' shape. Keep the circle clear and avoid collapsing the shape.",
      },
    ],

    practiceTips: [
      "Use a plain background so the handshape is easy to see.",
      "Hold each letter steady for at least 1-2 seconds.",
      "Keep your hand inside the camera frame, around chest or shoulder height.",
      "Avoid very bright or very dark lighting that hides finger details.",
      "Practice both slowly (for learning) and naturally (for recognition).",
    ],
  },
};

export default function ModuleView() {
  const { id } = useParams();
  const nav = useNavigate();

  const moduleData = modules[id] || modules["letters-basic"];

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100">
      {/* HEADER */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => nav(-1)}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-sm text-gray-300 hover:text-white hover:bg-white/10"
            >
              Back
            </button>
            <span className="text-sm font-semibold tracking-wide text-emerald-400">
              GESTURA LEARNING
            </span>
          </div>

          <nav className="flex items-center gap-4 text-sm">
            <Link to="/home" className="text-gray-300 hover:text-white">
              Home
            </Link>
            <Link to="/learnings" className="text-gray-300 hover:text-white">
              Data Collection
            </Link>
          </nav>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <section>
          <h1 className="text-3xl font-bold mb-1">{moduleData.title}</h1>
          <p className="text-emerald-300 text-sm mb-2">
            {moduleData.subtitle}
          </p>
          <p className="text-sm text-gray-300">{moduleData.description}</p>
        </section>

        {/* LETTER CARDS */}
        <section className="grid md:grid-cols-2 gap-4">
          {moduleData.letters.map((letter) => (
            <div
              key={letter.id}
              className="rounded-xl border border-white/10 bg-slate-900/60 p-4 flex gap-4"
            >
              <div className="w-14 h-14 rounded-lg bg-emerald-600/80 flex items-center justify-center text-2xl font-bold">
                {letter.id}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white mb-1">
                  {letter.label}
                </p>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {letter.notes}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* PRACTICE TIPS */}
        <section className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
          <h2 className="text-lg font-semibold mb-2 text-emerald-300">
            Practice Tips
          </h2>
          <ul className="list-disc list-inside text-sm text-gray-200 space-y-1">
            {moduleData.practiceTips.map((tip, idx) => (
              <li key={idx}>{tip}</li>
            ))}
          </ul>
        </section>

        {/* QUIZ BUTTONS */}
        <section className="flex flex-wrap gap-3">
          <Link
            to="/quiz/pretest-letters"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium"
          >
            Take Pre-Test
          </Link>
          <Link
            to="/quiz/posttest-letters"
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium"
          >
            Take Post-Test
          </Link>
        </section>
      </main>
    </div>
  );
}
