// src/pages/QuizPage.jsx
import { useParams, Link, useNavigate } from "react-router-dom";
import { useState } from "react";

const quizzes = {
  "pretest-letters": {
    title: "Pre-Test: Alphabet A, B, C, L, I, Y, O",
    description:
      "This short pre-test measures your initial familiarity with the handshapes used in Gestura. Answer based on your current knowledge, before practicing with the module.",
    questions: [
      {
        id: 1,
        question:
          "Which letter uses a closed fist with the thumb resting on the side of the hand?",
        options: ["A", "B", "C", "O"],
        answerIndex: 0, // A
        explanation: "Letter A is shown as a closed fist with the thumb on the side.",
      },
      {
        id: 2,
        question:
          "Which letter is formed by extending the index finger upward and the thumb sideways, like an 'L' shape?",
        options: ["I", "L", "Y", "B"],
        answerIndex: 1, // L
        explanation: "Letter L uses the index finger up and thumb out to form an 'L'.",
      },
      {
        id: 3,
        question:
          "Which handshape keeps all fingers extended together with the thumb folded across the palm?",
        options: ["B", "Y", "C", "I"],
        answerIndex: 0, // B
        explanation:
          "Letter B has all fingers straight and together, thumb across the palm.",
      },
      {
        id: 4,
        question:
          "Which letter uses only the little finger extended while the other fingers are folded down?",
        options: ["I", "Y", "A", "O"],
        answerIndex: 0, // I
        explanation: "Letter I extends just the pinky finger.",
      },
    ],
  },

  "posttest-letters": {
    title: "Post-Test: Alphabet A, B, C, L, I, Y, O",
    description:
      "This post-test checks what you learned after using the alphabet module and practicing with the system.",
    questions: [
      {
        id: 1,
        question:
          "Which letter forms a curved 'C' shape with the fingers and thumb, as if holding a cup?",
        options: ["C", "O", "A", "B"],
        answerIndex: 0, // C
        explanation:
          "Letter C creates a curved shape similar to holding a small cup.",
      },
      {
        id: 2,
        question:
          "Which letter extends both the thumb and little finger, with the other fingers folded?",
        options: ["Y", "L", "I", "C"],
        answerIndex: 0, // Y
        explanation:
          "Letter Y extends thumb and pinky, commonly seen like a 'call me' gesture.",
      },
      {
        id: 3,
        question:
          "Which letter forms a more complete circular 'O' shape instead of an open 'C'?",
        options: ["O", "C", "A", "Y"],
        answerIndex: 0, // O
        explanation:
          "Letter O closes the curve of the hand so it looks like a round 'O'.",
      },
      {
        id: 4,
        question:
          "Why is it important to keep a plain background when performing these letters in front of the camera?",
        options: [
          "To avoid confusing the hand detector with noisy backgrounds",
          "To make the video more colorful",
          "To hide the signer from the camera",
          "So the letters become faster to sign",
        ],
        answerIndex: 0,
        explanation:
          "A plain background reduces visual noise and helps the hand detection model focus on the gesture.",
      },
    ],
  },
};

export default function QuizPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const quiz = quizzes[id];

  // If wrong id in URL, fallback text
  if (!quiz) {
    return (
      <div className="min-h-screen bg-slate-950 text-gray-100 flex flex-col items-center justify-center">
        <p className="mb-4 text-sm text-gray-300">
          Quiz not found or invalid quiz ID.
        </p>
        <Link
          to="/learnings"
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm"
        >
          Go back to Learnings
        </Link>
      </div>
    );
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [finished, setFinished] = useState(false);

  const currentQuestion = quiz.questions[currentIndex];

  const handleSelect = (optionIndex) => {
    if (showExplanation) return; // lock after submit
    setSelectedOption(optionIndex);
  };

  const handleSubmit = () => {
    if (selectedOption === null) return;

    const isCorrect = selectedOption === currentQuestion.answerIndex;

    const newAnswers = [
      ...answers,
      {
        questionId: currentQuestion.id,
        chosen: selectedOption,
        correct: isCorrect,
      },
    ];

    setAnswers(newAnswers);
    setShowExplanation(true);
  };

  const handleNext = () => {
    setShowExplanation(false);
    setSelectedOption(null);

    if (currentIndex + 1 >= quiz.questions.length) {
      setFinished(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const score = answers.filter((a) => a.correct).length;
  const total = quiz.questions.length;
  const percentage = Math.round((score / total) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100">
      {/* HEADER */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => nav(-1)}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-sm text-gray-300 hover:text-white hover:bg-white/10"
            >
              Back
            </button>
            <span className="text-sm font-semibold tracking-wide text-emerald-400">
              GESTURA QUIZ
            </span>
          </div>

          <Link
            to="/learnings"
            className="text-xs text-gray-300 hover:text-white"
          >
            Data Collection
          </Link>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">{quiz.title}</h1>
        <p className="text-sm text-gray-300 mb-6">{quiz.description}</p>

        {/* RESULTS VIEW */}
        {finished ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 space-y-4">
            <h2 className="text-xl font-semibold">Quiz Completed</h2>
            <p className="text-sm text-gray-100">
              Score:{" "}
              <span className="font-bold">
                {score} / {total} ({percentage}%)
              </span>
            </p>
            <p className="text-xs text-gray-200">
              *You can use this result as part of your thesis pre-test / post-test
              reporting. Higher post-test scores indicate improved familiarity with
              the target handshapes and basic recognition guidelines.
            </p>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setCurrentIndex(0);
                  setSelectedOption(null);
                  setAnswers([]);
                  setShowExplanation(false);
                  setFinished(false);
                }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
              >
                Retake Quiz
              </button>
              <Link
                to="/module/letters-basic"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm"
              >
                Review Module
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* PROGRESS */}
            <div className="mb-4 flex justify-between items-center text-xs text-gray-400">
              <span>
                Question {currentIndex + 1} of {total}
              </span>
              <span>
                Correct so far: {answers.filter((a) => a.correct).length}
              </span>
            </div>

            {/* QUESTION CARD */}
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
              <p className="text-sm text-gray-100 font-medium">
                {currentQuestion.question}
              </p>

              <div className="space-y-2">
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect =
                    showExplanation && idx === currentQuestion.answerIndex;
                  const isWrong =
                    showExplanation &&
                    isSelected &&
                    idx !== currentQuestion.answerIndex;

                  let classes =
                    "w-full text-left px-3 py-2 rounded-lg border text-sm transition";

                  if (!showExplanation && isSelected) {
                    classes +=
                      " bg-sky-700/60 border-sky-400 text-white font-medium";
                  } else if (!showExplanation) {
                    classes +=
                      " bg-slate-800/80 border-slate-700 hover:bg-slate-700";
                  }

                  if (showExplanation && isCorrect) {
                    classes +=
                      " bg-emerald-700/60 border-emerald-400 text-white font-semibold";
                  } else if (showExplanation && isWrong) {
                    classes += " bg-rose-700/60 border-rose-400 text-white";
                  } else if (showExplanation && !isCorrect && !isWrong) {
                    classes += " bg-slate-800/80 border-slate-700";
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      className={classes}
                      onClick={() => handleSelect(idx)}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* EXPLANATION */}
              {showExplanation && (
                <div className="mt-3 p-3 rounded-lg bg-slate-800 border border-slate-600 text-xs text-gray-200">
                  <p className="font-semibold text-emerald-300 mb-1">
                    Explanation
                  </p>
                  <p>{currentQuestion.explanation}</p>
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex justify-end gap-3 pt-2">
                {!showExplanation ? (
                  <button
                    onClick={handleSubmit}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium"
                  >
                    {currentIndex + 1 >= total ? "Finish Quiz" : "Next Question"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}