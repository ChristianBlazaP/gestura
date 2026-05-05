import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect, useRef } from "react";
import API from "../services/api";
import { getTokenRole } from "../lib/auth";
import ASLVideo from "../assets/ASL.mp4";
import FSLVideo from "../assets/FSL.mp4";
import quickReviewImage from "../assets/quick-review.jpg";

function pickRandom(arr, n) {
  const copy = [...arr].sort(() => Math.random() - 0.5);
  return copy.slice(0, n);
}

const prePool = [
  {
    id: "pre1",
    q: "Which letter is formed by extending the thumb straight up while keeping other fingers closed...",
    options: ["A", "B", "C", "L"],
    answer: "A",
  },
  {
    id: "pre2",
    q: "The handshape that looks like a curved 'cup' most closely matches which letter...",
    options: ["C", "Y", "O", "I"],
    answer: "C",
  },
  {
    id: "pre3",
    q: "Which letter keeps the index finger up while others are closed...",
    options: ["I", "B", "Y", "L"],
    answer: "I",
  },
  {
    id: "pre4",
    q: "Which letter has the thumb across the palm with fingers straight and together...",
    options: ["B", "C", "Y", "A"],
    answer: "B",
  },
  {
    id: "pre5",
    q: "Which letter uses thumb and pinky extended with middle three curled...",
    options: ["Y", "I", "L", "B"],
    answer: "Y",
  },
  {
    id: "pre6",
    q: "Which letter is made with index and thumb straight, others curled...",
    options: ["L", "C", "Y", "A"],
    answer: "L",
  },
  {
    id: "pre7",
    q: "A curled hand with fingertips meeting thumb tip most closely matches...",
    options: ["O", "C", "B", "Y"],
    answer: "O",
  },
  {
    id: "pre8",
    q: "Which letter is a closed fist with thumb resting outside...",
    options: ["A", "C", "B", "Y"],
    answer: "A",
  },
  {
    id: "pre9",
    q: "Which letter keeps only the pinky extended up...",
    options: ["I", "Y", "L", "A"],
    answer: "I",
  },
  {
    id: "pre10",
    q: "Which letter is made by extending thumb and pinky, curling others...",
    options: ["Y", "L", "B", "C"],
    answer: "Y",
  },
  {
    id: "pre11",
    q: "For the letter L, the thumb and which finger are extended...",
    options: ["Index", "Pinky", "Middle", "Ring"],
    answer: "Index",
  },
  {
    id: "pre12",
    q: "Which shape looks like a relaxed arc, wider than O...",
    options: ["C", "B", "L", "I"],
    answer: "C",
  },
  {
    id: "pre13",
    q: "Which letter is made by crossing the index and middle fingers...",
    options: ["R", "K", "V", "U"],
    answer: "R",
  },
  {
    id: "pre14",
    q: "Which letter tucks the thumb between the index and middle fingers...",
    options: ["T", "S", "M", "N"],
    answer: "T",
  },
  {
    id: "pre15",
    q: "Which letter places the thumb under three fingers...",
    options: ["M", "N", "S", "T"],
    answer: "M",
  },
  {
    id: "pre16",
    q: "Which letter places the thumb under two fingers...",
    options: ["N", "M", "S", "T"],
    answer: "N",
  },
  {
    id: "pre17",
    q: "Which letter uses index and middle up with the thumb touching the middle finger...",
    options: ["K", "P", "V", "R"],
    answer: "K",
  },
  {
    id: "pre18",
    q: "Which letter is made by extending index and middle fingers spread apart...",
    options: ["V", "U", "W", "Y"],
    answer: "V",
  },
  {
    id: "pre19",
    q: "Which letter uses a bent index finger like a hook...",
    options: ["X", "C", "G", "Q"],
    answer: "X",
  },
  {
    id: "pre20",
    q: "Which letter uses index and middle fingers up together (not spread)...",
    options: ["U", "V", "W", "R"],
    answer: "U",
  },
  {
    id: "pre21",
    q: "Which letter uses index, middle, and ring fingers up...",
    options: ["W", "B", "V", "U"],
    answer: "W",
  },
  {
    id: "pre22",
    q: "Which letter makes a small circle using thumb and index while other fingers stay up...",
    options: ["F", "O", "C", "Y"],
    answer: "F",
  },
  {
    id: "pre23",
    q: "Which letter uses the index and thumb extended sideways like a pinch...",
    options: ["G", "Q", "L", "P"],
    answer: "G",
  },
];

const postPool = [
  {
    id: "post1",
    q: "For the letter Y, which fingers point outward...",
    options: ["Thumb and pinky", "Index only", "All fingers", "Middle finger only"],
    answer: "Thumb and pinky",
  },
  {
    id: "post2",
    q: "For the letter O, what is the main shape of the hand...",
    options: ["Flat palm", "Fist", "Circle", "V-shape"],
    answer: "Circle",
  },
  {
    id: "post3",
    q: "For the letter B, what are the fingers doing...",
    options: ["Curved into a cup", "Straight and together", "Spread widely", "Thumb between fingers"],
    answer: "Straight and together",
  },
  {
    id: "post4",
    q: "For the letter L, what fingers are extended...",
    options: ["Thumb and index", "Thumb and pinky", "Index only", "All fingers"],
    answer: "Thumb and index",
  },
  {
    id: "post5",
    q: "Which letter uses only the pinky extended...",
    options: ["I", "Y", "L", "C"],
    answer: "I",
  },
  {
    id: "post6",
    q: "For the letter C, the hand shape resembles a:",
    options: ["Cup/arc", "Flat palm", "Circle", "Fist"],
    answer: "Cup/arc",
  },
  {
    id: "post7",
    q: "The letter A keeps which part outside the fist...",
    options: ["Thumb", "Index", "Pinky", "Middle"],
    answer: "Thumb",
  },
  {
    id: "post8",
    q: "The letter B requires the fingers to be:",
    options: ["Straight and together", "Curled tightly", "Thumb out", "Thumb between fingers"],
    answer: "Straight and together",
  },
  {
    id: "post9",
    q: "The letter L uses thumb and index; the other fingers are:",
    options: ["Curled", "Straight", "Spread wide", "Tucked between"],
    answer: "Curled",
  },
  {
    id: "post10",
    q: "The letter Y extends thumb and pinky; the middle three are:",
    options: ["Curled", "Straight", "Spread", "Hidden"],
    answer: "Curled",
  },
  {
    id: "post11",
    q: "The letter I is most similar to Y but without:",
    options: ["Thumb extension", "Pinky extension", "Curled fingers", "Palm facing out"],
    answer: "Thumb extension",
  },
  {
    id: "post12",
    q: "Which letter forms a small circle with all fingers curled...",
    options: ["O", "C", "B", "L"],
    answer: "O",
  },
  {
    id: "post13",
    q: "For the letter M, the thumb is placed:",
    options: ["Under three fingers", "Across the palm", "Between index and middle", "Over the fingers"],
    answer: "Under three fingers",
  },
  {
    id: "post14",
    q: "For the letter N, the thumb is placed:",
    options: ["Under two fingers", "Across the palm", "Between ring and pinky", "Over the fingers"],
    answer: "Under two fingers",
  },
  {
    id: "post15",
    q: "For the letter T, the thumb is:",
    options: ["Between index and middle", "Across the palm", "Pointing up", "Touching the pinky"],
    answer: "Between index and middle",
  },
  {
    id: "post16",
    q: "For the letter S, the thumb is:",
    options: ["Across the front of the fist", "Between index and middle", "Pointing up", "Behind the fingers"],
    answer: "Across the front of the fist",
  },
  {
    id: "post17",
    q: "The letter R is identified by:",
    options: ["Crossed index and middle", "Index and middle spread", "Thumb and pinky out", "Index bent"],
    answer: "Crossed index and middle",
  },
  {
    id: "post18",
    q: "How does U differ from V...",
    options: ["U fingers together, V spread", "U uses thumb, V uses pinky", "U is a fist", "V is a fist"],
    answer: "U fingers together, V spread",
  },
  {
    id: "post19",
    q: "The letter G uses:",
    options: ["Index and thumb extended sideways", "Index and middle spread", "Thumb and pinky", "All fingers up"],
    answer: "Index and thumb extended sideways",
  },
  {
    id: "post20",
    q: "The letter P is like K but:",
    options: ["Points down", "Points up", "Uses only the pinky", "Is a fist"],
    answer: "Points down",
  },
  {
    id: "post21",
    q: "The letter W uses which fingers...",
    options: ["Index, middle, ring", "Thumb, index, middle", "Index and middle", "Middle, ring, pinky"],
    answer: "Index, middle, ring",
  },
  {
    id: "post22",
    q: "The letter X uses:",
    options: ["Index bent like a hook", "Index straight", "Pinky only", "Thumb and index circle"],
    answer: "Index bent like a hook",
  },
  {
    id: "post23",
    q: "The letter H uses:",
    options: ["Index and middle together sideways", "Index only", "Thumb and pinky out", "Three fingers up"],
    answer: "Index and middle together sideways",
  },
];

const preDifficultyMap = {
  easy: [
    "pre1",
    "pre2",
    "pre3",
    "pre4",
    "pre5",
    "pre6",
    "pre9",
    "pre10",
    "pre11",
    "pre12",
  ],
  medium: [
    "pre1",
    "pre2",
    "pre3",
    "pre4",
    "pre5",
    "pre6",
    "pre7",
    "pre8",
    "pre11",
    "pre12",
    "pre13",
    "pre17",
    "pre18",
    "pre19",
    "pre20",
    "pre21",
    "pre22",
    "pre23",
  ],
  hard: prePool.map((q) => q.id),
};

const postDifficultyMap = {
  easy: [
    "post1",
    "post2",
    "post3",
    "post4",
    "post5",
    "post6",
    "post7",
    "post8",
    "post9",
    "post10",
    "post11",
    "post12",
  ],
  medium: [
    "post1",
    "post2",
    "post3",
    "post4",
    "post5",
    "post6",
    "post7",
    "post8",
    "post9",
    "post10",
    "post11",
    "post12",
    "post17",
    "post18",
    "post19",
    "post21",
    "post22",
    "post23",
  ],
  hard: postPool.map((q) => q.id),
};

function selectPool(pool, map, difficulty) {
  const ids = map[difficulty] || pool.map((q) => q.id);
  const idSet = new Set(ids);
  return pool.filter((q) => idSet.has(q.id));
}

const feedbackDefaults = {
  notes: "",
};

const demoDefaults = [
  { id: "asl-demo", title: "ASL Alphabet Demo", src: ASLVideo },
  { id: "fsl-demo", title: "FSL Alphabet Demo", src: FSLVideo },
];

function mapAssessmentRows(rows = []) {
  return rows
    .map((row) => {
      const options = [
        row.choice_a,
        row.choice_b,
        row.choice_c,
        row.choice_d,
      ].filter(Boolean);
      if (!row.question || options.length < 2) return null;
      const correctRaw = String(row.correct_answer || "").trim();
      const indexMap = { A: 0, B: 1, C: 2, D: 3 };
      const correct =
        indexMap[correctRaw] !== undefined
          ? options[indexMap[correctRaw]]
          : correctRaw || options[0];
      return {
        id: `db-${row.id}`,
        q: row.question,
        options,
        answer: correct,
      };
    })
    .filter(Boolean);
}

const QUICK_REVIEW_COLS = 4;
const QUICK_REVIEW_ITEMS = [
  "A","B","C","D",
  "E","F","G","H",
  "I","K","L","M",
  "N","O","P","Q",
  "R","S","T","U",
  "V","W","X","Y",
].map((letter, idx) => ({
  letter,
  col: idx % QUICK_REVIEW_COLS,
  row: Math.floor(idx / QUICK_REVIEW_COLS),
}));
const QUICK_REVIEW_ROWS = Math.ceil(QUICK_REVIEW_ITEMS.length / QUICK_REVIEW_COLS);

function Quiz({
  title,
  questions,
  onSubmit,
  disabled,
  timeLeft,
  submitted,
  formatTime,
  reviewAnswers,
}) {
  const [answers, setAnswers] = useState({});
  const [page, setPage] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const perPage = 5;
  const totalPages = Math.ceil(questions.length / perPage);
  const start = page * perPage;
  const end = start + perPage;
  const pageQuestions = questions.slice(start, end);
  const effectiveAnswers = submitted
    ? reviewAnswers && Object.keys(reviewAnswers).length > 0
      ? reviewAnswers
      : answers
    : answers;
  const allAnswered = questions.every((q) => answers[q.id]);
  const answeredCount = Object.keys(effectiveAnswers).length;
  const progress = questions.length ? answeredCount / questions.length : 0;

  useEffect(() => {
    if (submitted) {
      setReviewMode(true);
    } else {
      setReviewMode(false);
    }
  }, [submitted, questions]);

  return (
    <div className="rounded-2xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.35)] space-y-4 bg-[#f3eadc] text-slate-900 border border-emerald-200/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600">
              Page {page + 1} of {totalPages} - Answered {answeredCount}/{questions.length}
            </p>
          <div className="h-2 rounded-full bg-emerald-100/70 border border-emerald-200/70 overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {typeof timeLeft === "number" && (
            <span
              className={`text-xs px-3 py-1 rounded-full border ${
                timeLeft > 0
                  ? "border-emerald-300 text-emerald-800 bg-emerald-100"
                  : "border-rose-300 text-rose-700 bg-rose-100"
              }`}
            >
              Time left: {timeLeft > 0 ? formatTime(timeLeft) : "0:00"}
            </span>
          )}
          {!disabled && !submitted && timeLeft > 0 && page === totalPages - 1 && (
            <button
              onClick={() => {
                if (!allAnswered) return;
                onSubmit(answers);
              }}
              disabled={!allAnswered}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-slate-50 disabled:bg-slate-300 disabled:text-slate-500"
            >
              Submit
            </button>
          )}
          {(submitted || timeLeft <= 0) && (
            <span className="text-xs text-slate-600">
              {submitted ? "Submitted" : "Time is up"}
            </span>
          )}
          {submitted && !reviewMode && (
            <button
              type="button"
              onClick={() => setReviewMode(true)}
              className="px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-300 text-emerald-800 bg-emerald-100 hover:bg-emerald-200"
            >
              Review answers
            </button>
          )}
        </div>
      </div>
      <div className="rounded-xl p-5 bg-[#fff7eb] border border-emerald-200/80 space-y-5">
        {pageQuestions.map((q) => (
          <div key={q.id} className="space-y-2">
            <p className="text-slate-900 font-semibold text-base">{q.q}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {q.options.map((opt) => {
                const isSelected = effectiveAnswers[q.id] === opt;
                const isCorrect = reviewMode && q.answer === opt;
                const isWrongSelected = reviewMode && isSelected && q.answer !== opt;
                const baseStyle =
                  "border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50";
                const selectedStyle =
                  "border-emerald-400 bg-emerald-300/30 text-emerald-900";
                const correctStyle =
                  "border-emerald-500 bg-emerald-200 text-emerald-900";
                const wrongStyle =
                  "border-rose-400 bg-rose-200/70 text-rose-900";
                const styleClass = isCorrect
                  ? correctStyle
                  : isWrongSelected
                  ? wrongStyle
                  : isSelected
                  ? selectedStyle
                  : baseStyle;
                return (
                  <label
                    key={opt}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer shadow-sm ${styleClass}`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={isSelected}
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                        }
                        disabled={submitted || reviewMode}
                        className="accent-emerald-500"
                      />
                      <span className="text-base">{opt}</span>
                    </span>
                    {reviewMode && isCorrect && (
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Correct
                      </span>
                    )}
                    {reviewMode && isWrongSelected && (
                      <span className="text-[11px] font-semibold text-rose-700">
                        Your answer
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {reviewMode && (
              <p className="text-xs text-emerald-700">
                Correct answer: {q.answer}
              </p>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            disabled={page === 0}
            className="px-4 py-2 rounded-lg text-base border border-slate-200 text-slate-700 disabled:opacity-40 shadow-sm"
            type="button"
          >
            Previous
          </button>
          <button
            onClick={() =>
              setPage((prev) => Math.min(totalPages - 1, prev + 1))
            }
            disabled={page === totalPages - 1}
            className="px-4 py-2 rounded-lg text-base border border-emerald-400/60 text-emerald-800 hover:bg-emerald-200/40 disabled:opacity-40 shadow-sm"
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CollectDatasetPro() {
  const isAdmin = getTokenRole() === "admin";
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState("medium");
  const [prePoolSource, setPrePoolSource] = useState(prePool);
  const [postPoolSource, setPostPoolSource] = useState(postPool);
  const [prePoolUsesDifficulty, setPrePoolUsesDifficulty] = useState(true);
  const [postPoolUsesDifficulty, setPostPoolUsesDifficulty] = useState(true);
  const [preSet, setPreSet] = useState(() =>
    pickRandom(selectPool(prePool, preDifficultyMap, "medium"), 10)
  );
  const [postSet, setPostSet] = useState(() =>
    pickRandom(selectPool(postPool, postDifficultyMap, "medium"), 10)
  );
  const [preScore, setPreScore] = useState(null);
  const [postScore, setPostScore] = useState(null);
  const [preDifficultyUsed, setPreDifficultyUsed] = useState(null);
  const [postDifficultyUsed, setPostDifficultyUsed] = useState(null);
  const [preSubmitted, setPreSubmitted] = useState(false);
  const [postSubmitted, setPostSubmitted] = useState(false);
  const [preReviewAnswers, setPreReviewAnswers] = useState({});
  const [postReviewAnswers, setPostReviewAnswers] = useState({});
  const [preStarted, setPreStarted] = useState(false);
  const [postStarted, setPostStarted] = useState(false);
  const [preResetKey, setPreResetKey] = useState(0);
  const [postResetKey, setPostResetKey] = useState(0);
  const [preTime, setPreTime] = useState(300);
  const [postTime, setPostTime] = useState(300);
  const timerRef = useRef({ pre: null, post: null });
  const [feedbackForm, setFeedbackForm] = useState({ ...feedbackDefaults });
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("tests");
  const [activeTest, setActiveTest] = useState("pre");
  const [demoVideos, setDemoVideos] = useState(demoDefaults);
  const [feedbackError, setFeedbackError] = useState("");
  const [quizLockMsg, setQuizLockMsg] = useState("");
  const [reviewActive, setReviewActive] = useState(false);
  const [reviewTime, setReviewTime] = useState(300);
  const [reviewSkipped, setReviewSkipped] = useState(false);
  const reviewTimerRef = useRef(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [pendingQuiz, setPendingQuiz] = useState(null);
  const pendingQuizRef = useRef(null);
  const [recordMenuOpen, setRecordMenuOpen] = useState(false);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [recordLabel, setRecordLabel] = useState("");
  const [recordingStatus, setRecordingStatus] = useState("");
  const [recordingError, setRecordingError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [assessmentSyncMsg, setAssessmentSyncMsg] = useState("");
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const liveVideoRef = useRef(null);

  const difficultyCount = useMemo(() => {
    if (difficulty === "easy") return 6;
    if (difficulty === "hard") return 14;
    return 10;
  }, [difficulty]);

  const getPrePool = () =>
    prePoolUsesDifficulty
      ? selectPool(prePoolSource, preDifficultyMap, difficulty)
      : prePoolSource;

  const getPostPool = () =>
    postPoolUsesDifficulty
      ? selectPool(postPoolSource, postDifficultyMap, difficulty)
      : postPoolSource;

  const quizInProgress =
    (activeTest === "pre" ? preStarted : postStarted) &&
    !(activeTest === "pre" ? preSubmitted : postSubmitted) &&
    (activeTest === "pre" ? preTime : postTime) > 0;

  useEffect(() => {
    if (!feedbackSaved) return;
    const timer = setTimeout(() => setFeedbackSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [feedbackSaved]);

  useEffect(() => {
    let alive = true;
    const loadContent = async () => {
      try {
        const demoRes = await API.get("/api/learning/demo-videos");
        if (!alive) return;
        const baseUrl = API.defaults.baseURL || "";
        const videos = (demoRes.data?.videos || []).map((video) => {
          const rawUrl = video.youtube_url || "";
          const resolved =
            rawUrl.startsWith("/uploads/") && baseUrl
              ? `${baseUrl}${rawUrl}`
              : rawUrl;
          return {
            id: `db-demo-${video.id}`,
            title: video.letter || "Demo video",
            src: resolved,
          };
        });
        if (videos.length > 0) {
          setDemoVideos(videos);
        }
      } catch {
        // keep defaults
      }

      try {
        const [preRes, postRes] = await Promise.all([
          API.get("/api/learning/assessment-questions?type=pre"),
          API.get("/api/learning/assessment-questions?type=post"),
        ]);
        if (!alive) return;
        const preQuestions = mapAssessmentRows(preRes.data?.questions || []);
        const postQuestions = mapAssessmentRows(postRes.data?.questions || []);
        if (preQuestions.length > 0) {
          setPrePoolSource(preQuestions);
          setPrePoolUsesDifficulty(false);
        }
        if (postQuestions.length > 0) {
          setPostPoolSource(postQuestions);
          setPostPoolUsesDifficulty(false);
        }
      } catch {
        // fall back to defaults
      }
    };
    loadContent();
    return () => {
      alive = false;
    };
  }, []);

  function grade(answers, questions) {
    let score = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.answer) score += 1;
    });
    return score;
  }

  const formatDifficulty = (value) => {
    if (!value) return "-";
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  function handlePreSubmit(answers) {
    if (preSubmitted) return;
    if (preTime <= 0) return;
    setAssessmentSyncMsg("");
    const token = localStorage.getItem("token");
    console.log("[Assessment] token present:", Boolean(token));
    const score = grade(answers, preSet);
    setPreScore(score);
    setPreReviewAnswers(answers);
    setPreDifficultyUsed(difficulty);
    setPreSubmitted(true);
    setPreStarted(false);
    API.post("/api/learning/assessment", {
      assessment_type: "pre",
      difficulty,
      score,
      total_questions: preSet.length,
      time_left: preTime,
      duration_sec: Math.max(0, 300 - preTime),
    }).catch((err) => {
      if (err?.response?.status === 401) {
        setAssessmentSyncMsg("Score saved locally. Please sign in again to sync results.");
      } else {
        setAssessmentSyncMsg("Score saved locally. Could not sync to server.");
      }
    });
    if (timerRef.current.pre) {
      clearInterval(timerRef.current.pre);
      timerRef.current.pre = null;
    }
  }

  function handlePostSubmit(answers) {
    if (postSubmitted) return;
    if (postTime <= 0) return;
    setAssessmentSyncMsg("");
    const token = localStorage.getItem("token");
    console.log("[Assessment] token present:", Boolean(token));
    const score = grade(answers, postSet);
    setPostScore(score);
    setPostReviewAnswers(answers);
    setPostDifficultyUsed(difficulty);
    setPostSubmitted(true);
    setPostStarted(false);
    API.post("/api/learning/assessment", {
      assessment_type: "post",
      difficulty,
      score,
      total_questions: postSet.length,
      time_left: postTime,
      duration_sec: Math.max(0, 300 - postTime),
    }).catch((err) => {
      if (err?.response?.status === 401) {
        setAssessmentSyncMsg("Score saved locally. Please sign in again to sync results.");
      } else {
        setAssessmentSyncMsg("Score saved locally. Could not sync to server.");
      }
    });
    if (timerRef.current.post) {
      clearInterval(timerRef.current.post);
      timerRef.current.post = null;
    }
  }

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();
    const notes = feedbackForm.notes.trim();
    if (!notes) return;
    setFeedbackError("");
    try {
      await API.post("/api/feedback", { message: notes });
    } catch (err) {
      setFeedbackError(err.response?.data?.error || "Failed to send feedback.");
      return;
    }
    setFeedbackForm({ ...feedbackDefaults });
    setFeedbackSaved(true);
  };

  function resetQuiz(kind, reason = "") {
    if (kind === "pre") {
      setPreSet(
        pickRandom(getPrePool(), difficultyCount)
      );
      setPreScore(null);
      setPreDifficultyUsed(null);
      setPreReviewAnswers({});
      setAssessmentSyncMsg("");
      setPreSubmitted(false);
      setPreStarted(false);
      setPreTime(300);
      setPreResetKey((v) => v + 1);
      if (timerRef.current.pre) {
        clearInterval(timerRef.current.pre);
        timerRef.current.pre = null;
      }
    } else {
      setPostSet(
        pickRandom(getPostPool(), difficultyCount)
      );
      setPostScore(null);
      setPostDifficultyUsed(null);
      setPostReviewAnswers({});
      setAssessmentSyncMsg("");
      setPostSubmitted(false);
      setPostStarted(false);
      setPostTime(300);
      setPostResetKey((v) => v + 1);
      if (timerRef.current.post) {
        clearInterval(timerRef.current.post);
        timerRef.current.post = null;
      }
    }
    if (reason) {
      setQuizLockMsg(reason);
      setTimeout(() => setQuizLockMsg(""), 2500);
    }
  }

  function beginQuiz(kind) {
    if (kind === "pre") {
      setActiveTest("pre");
      setPreSet(
        pickRandom(getPrePool(), difficultyCount)
      );
      setPreTime(300);
      setPreStarted(true);
      setPreSubmitted(false);
      setPreScore(null);
      setPreReviewAnswers({});
    } else {
      setActiveTest("post");
      setPostSet(
        pickRandom(getPostPool(), difficultyCount)
      );
      setPostTime(300);
      setPostStarted(true);
      setPostSubmitted(false);
      setPostScore(null);
      setPostReviewAnswers({});
    }
  }

  function startQuiz(kind) {
    setQuizLockMsg("");
    setPendingQuiz(kind);
    setReviewSkipped(false);
    setReviewTime(300);
    setReviewActive(true);
    setReviewModalOpen(true);
  }

  // timers
  useEffect(() => {
    if (!preSubmitted && preStarted && !timerRef.current.pre) {
      timerRef.current.pre = setInterval(() => {
        setPreTime((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current.pre);
            timerRef.current.pre = null;
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current.pre) clearInterval(timerRef.current.pre);
    };
  }, [preSubmitted, preStarted]);

  useEffect(() => {
    if (!postSubmitted && postStarted && !timerRef.current.post) {
      timerRef.current.post = setInterval(() => {
        setPostTime((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current.post);
            timerRef.current.post = null;
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current.post) clearInterval(timerRef.current.post);
    };
  }, [postSubmitted, postStarted]);

  useEffect(() => {
    if (!quizInProgress) return;
    const handleVisibility = () => {
      if (document.hidden) {
        resetQuiz(activeTest, "Quiz reset after leaving the screen.");
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        resetQuiz(activeTest, "Quiz reset. Start again to continue.");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("keydown", handleKey);
    };
  }, [quizInProgress, activeTest, difficulty, difficultyCount]);

  useEffect(() => {
    if (!reviewActive) return;
    if (reviewTimerRef.current) return;
    reviewTimerRef.current = setInterval(() => {
      setReviewTime((t) => {
        if (t <= 1) {
          clearInterval(reviewTimerRef.current);
          reviewTimerRef.current = null;
          setReviewActive(false);
          setReviewModalOpen(false);
          setReviewSkipped(true);
          if (pendingQuizRef.current) {
            beginQuiz(pendingQuizRef.current);
            setPendingQuiz(null);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (reviewTimerRef.current) {
        clearInterval(reviewTimerRef.current);
        reviewTimerRef.current = null;
      }
    };
  }, [reviewActive]);

  useEffect(() => {
    pendingQuizRef.current = pendingQuiz;
  }, [pendingQuiz]);

  useEffect(() => {
    setPreSet(pickRandom(getPrePool(), difficultyCount));
    setPostSet(pickRandom(getPostPool(), difficultyCount));
    setPreScore(null);
    setPostScore(null);
    setPreDifficultyUsed(null);
    setPostDifficultyUsed(null);
    setAssessmentSyncMsg("");
    setPreSubmitted(false);
    setPostSubmitted(false);
    setPreTime(300);
    setPostTime(300);
    if (timerRef.current.pre) {
      clearInterval(timerRef.current.pre);
      timerRef.current.pre = null;
    }
    if (timerRef.current.post) {
      clearInterval(timerRef.current.post);
      timerRef.current.post = null;
    }
  }, [
    difficulty,
    difficultyCount,
    prePoolSource,
    postPoolSource,
    prePoolUsesDifficulty,
    postPoolUsesDifficulty,
  ]);

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  const stopRecordingStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  };

  const startRecording = async () => {
    setRecordingError("");
    setRecordingStatus("");
    setRecordedBlob(null);
    setRecordedUrl("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (liveVideoRef.current) liveVideoRef.current.srcObject = stream;
      recordChunksRef.current = [];
      const mimeType =
        MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordChunksRef.current, {
          type: recorder.mimeType,
        });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
      };
      recorder.start(150);
      setIsRecording(true);
      setRecordingStatus("Recording…");
    } catch (err) {
      setRecordingError("Camera access denied or unavailable.");
      stopRecordingStream();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingStatus("Recording stopped.");
    stopRecordingStream();
  };

  const handleSaveRecording = async () => {
    if (!recordedBlob) {
      setRecordingError("Please record a short clip first.");
      return;
    }
    setRecordingError("");
    setRecordingStatus("Uploading…");
    const form = new FormData();
    form.append("video", recordedBlob, `recording-${Date.now()}.webm`);
    if (recordLabel) form.append("label", recordLabel);
    try {
      await API.post("/api/recordings", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRecordingStatus("Saved to your account recordings.");
    } catch (err) {
      setRecordingError(
        err.response?.data?.error || "Failed to upload recording."
      );
      setRecordingStatus("");
    }
  };

  useEffect(() => {
    if (!recordModalOpen) {
      setIsRecording(false);
      stopRecordingStream();
    }
    return () => stopRecordingStream();
  }, [recordModalOpen]);

  return (
    <div className="app-shell text-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header
          id="overview"
          className="relative rounded-2xl p-6 bg-gradient-to-br from-[#0f2b24] via-[#14372f] to-[#1b463c] border border-emerald-300/30 shadow-[0_20px_55px_rgba(5,15,20,0.6)] backdrop-blur"
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <span className="text-[11px] tracking-[0.28em] uppercase text-emerald-200/80">
                  Learning Studio
                </span>
                <h1 className="text-3xl sm:text-4xl font-semibold text-white">Learning &amp; Assessment</h1>
                <p className="text-slate-200 text-sm max-w-2xl">
                  Pre-test, guided demos, then post-test. Analytics update after every submission for quick
                  feedback and reporting.
                </p>
              </div>
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRecordMenuOpen((prev) => !prev)}
                  className="w-9 h-9 rounded-lg border border-white/15 bg-white/10 hover:bg-white/20 text-white text-lg"
                  aria-haspopup="menu"
                  aria-expanded={recordMenuOpen}
                  title="More options"
                >
                  ...
                </button>
                <Link
                  to="/home"
                  onClick={(event) => {
                    if (quizInProgress) {
                      event.preventDefault();
                      setQuizLockMsg("Finish or reset the quiz before leaving.");
                    }
                  }}
                  className={`px-4 py-2 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-sm shadow-sm ${
                    quizInProgress ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Home
                </Link>
                {recordMenuOpen && (
                  <div className="absolute right-0 top-12 z-20 w-72 sm:w-80 max-w-[90vw] rounded-xl border border-emerald-200/40 bg-slate-950/90 text-white shadow-lg p-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRecordMenuOpen(false);
                        setRecordModalOpen(true);
                      }}
                      className="w-full text-left rounded-lg border border-emerald-400/40 bg-emerald-900/30 px-4 py-3 hover:bg-emerald-800/40 transition"
                    >
                      <div className="text-sm font-semibold">Record your own sign language</div>
                      <div className="mt-1 text-[11px] text-emerald-100/80">
                        Short clips help improve recognition and learning resources.
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-200/90">
                        <span className="click-hint" aria-hidden>
                          &gt;
                        </span>
                        Click to start recording
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {[
              { id: "tests", label: "Pre/Post Tests" },
              { id: "review", label: "ASL Reviewer" },
              { id: "demo", label: "Demo Videos" },
              { id: "feedback", label: "Feedback" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (quizInProgress) {
                    setQuizLockMsg("Finish or reset the quiz before switching tabs.");
                    return;
                  }
                  setActiveTab(tab.id);
                }}
                disabled={quizInProgress}
                className={`px-4 py-2 rounded-full text-xs font-semibold border transition shadow-sm ${
                  activeTab === tab.id
                    ? "border-emerald-200 bg-emerald-200/25 text-white shadow-[0_0_20px_rgba(52,211,153,0.35)]"
                    : "border-white/15 text-emerald-100/80 hover:border-emerald-300/70 hover:text-emerald-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
            {quizLockMsg && (
              <span className="text-xs text-amber-200/90 ml-2">{quizLockMsg}</span>
            )}
          </div>
        </header>

        {activeTab === "review" && (
          <section
            id="asl-reviewer"
            className="rounded-2xl p-6 space-y-5 bg-[#f7f1e7] border border-emerald-300/40 shadow-[0_18px_55px_rgba(5,15,20,0.45)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">ASL Reviewer</h3>
                <p className="text-sm text-slate-700">
                  Quick alphabet review before testing or practice.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-emerald-800">
              {reviewActive ? (
                <span className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200">
                  Time left: {fmtTime(reviewTime)}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200">
                  {reviewSkipped ? "Skipped" : "Ready"}
                </span>
              )}
              <span className="text-slate-600">Scroll to see the full alphabet grid.</span>
            </div>
            <div className="max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {QUICK_REVIEW_ITEMS.map((item) => (
                  <div
                    key={item.letter}
                    className="rounded-2xl border border-emerald-200/80 bg-white/80 p-3 shadow-[0_10px_25px_rgba(5,15,20,0.2)]"
                  >
                    <div
                      className="w-full aspect-[4/3] rounded-xl border border-emerald-200/70 bg-emerald-50"
                      style={{
                        backgroundImage: `url(${quickReviewImage})`,
                        backgroundSize: `${QUICK_REVIEW_COLS * 100}% ${QUICK_REVIEW_ROWS * 100}%`,
                        backgroundPosition: `${(item.col / (QUICK_REVIEW_COLS - 1)) * 100}% ${(
                          item.row / (QUICK_REVIEW_ROWS - 1)
                        ) * 100}%`,
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                    <div className="mt-2 text-xs font-semibold text-slate-700">
                      Letter {item.letter}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "demo" && (
          <section
            id="demo-videos"
            className="rounded-2xl p-6 space-y-6 bg-[#f7f1e7] border border-emerald-300/40 shadow-[0_18px_55px_rgba(5,15,20,0.45)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-900">Teacher Demo Videos</h3>
                <p className="text-sm text-slate-700 max-w-2xl">
                  Short, focused clips to model each alphabet handshape with consistent framing.
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-900/70">
                  <span className="px-2 py-1 rounded-full border border-emerald-300/50 bg-emerald-200/40">
                    ASL + FSL
                  </span>
                  <span className="px-2 py-1 rounded-full border border-emerald-300/50 bg-emerald-200/40">
                    Optional section
                  </span>
                </div>
              </div>
            </div>
            {demoVideos.length === 0 ? (
              <div className="rounded-xl p-6 text-sm text-slate-700 bg-white/70 border border-emerald-300/30">
                Demo videos are optional. Add instructional clips when they are ready.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {demoVideos.map((video) => (
                  <div
                    key={video.id}
                    className="rounded-2xl p-4 bg-white/80 border border-emerald-300/40 shadow-[0_10px_30px_rgba(5,15,20,0.2)] space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{video.title}</p>
                      <span className="text-[11px] text-slate-500">MP4 demo</span>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-emerald-200/60 bg-black/10 aspect-video">
                      <video src={video.src} controls className="w-full h-full object-cover" />
                    </div>
                    <div className="text-xs text-slate-600">
                      Tip: pause after each letter and match the hand height to the frame.
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "tests" && (
          <section id="tests" className="space-y-5">
            <div className="rounded-2xl p-4 bg-[#f7f1e7] border border-emerald-300/40 shadow-[0_10px_30px_rgba(5,15,20,0.3)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-800">Select difficulty:</p>
                <span className="text-xs text-slate-600">Questions: {difficultyCount}</span>
              </div>
              <div className="mt-3 inline-flex rounded-full border border-emerald-300/40 bg-emerald-200/40 p-1">
                {[
                  { id: "easy", label: "Easy" },
                  { id: "medium", label: "Medium" },
                  { id: "hard", label: "Hard" },
                ].map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setDifficulty(level.id)}
                    className={`px-4 py-1.5 text-sm rounded-full transition ${
                      difficulty === level.id
                        ? "bg-emerald-500 text-slate-950 shadow-[0_0_14px_rgba(52,211,153,0.35)]"
                        : "text-slate-700 hover:text-emerald-800"
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl p-4 bg-[#f7f1e7] border border-emerald-300/40 shadow-[0_10px_30px_rgba(5,15,20,0.3)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Score summary</p>
                  <p className="text-xs text-slate-600">
                    Latest results from your assessments.
                  </p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (quizInProgress) {
                        setQuizLockMsg("Finish or reset the quiz before leaving.");
                        return;
                      }
                      navigate("/admin");
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition shadow-sm ${
                      quizInProgress
                        ? "border-white/20 text-slate-400 cursor-not-allowed"
                        : "border-emerald-400/70 text-emerald-800 hover:border-emerald-500 hover:text-emerald-900"
                    }`}
                  >
                    View Scores
                  </button>
                )}
              </div>
              {assessmentSyncMsg && (
                <p className="mt-2 text-xs text-amber-700">{assessmentSyncMsg}</p>
              )}
              <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs text-slate-700">
                <div className="rounded-xl border border-emerald-200/70 bg-white/70 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Pre-test</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {typeof preScore === "number"
                      ? `${preScore}/${preSet.length}`
                      : "Not taken yet"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Level: {formatDifficulty(preDifficultyUsed)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200/70 bg-white/70 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Post-test</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {typeof postScore === "number"
                      ? `${postScore}/${postSet.length}`
                      : "Not taken yet"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Level: {formatDifficulty(postDifficultyUsed)}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                {
                  id: "pre",
                  title: "Pre-test",
                  description: `${preSet.length} questions - Warm-up assessment`,
                  status: preSubmitted ? "Completed" : "Not started",
                  badge: preSubmitted ? "Ready" : "Warm-up",
                  score: preScore,
                  started: preStarted,
                },
                {
                  id: "post",
                  title: "Post-test",
                  description: `${postSet.length} questions - Endline assessment`,
                  status: postSubmitted ? "Completed" : "Not started",
                  badge: postSubmitted ? "Complete" : "Checkpoint",
                  score: postScore,
                  started: postStarted,
                },
              ].map((card) => (
                <div
                  key={card.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (quizInProgress && activeTest !== card.id) {
                      setQuizLockMsg("Finish or reset the current quiz first.");
                      return;
                    }
                    setActiveTest(card.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    if (quizInProgress && activeTest !== card.id) {
                      setQuizLockMsg("Finish or reset the current quiz first.");
                      return;
                    }
                    setActiveTest(card.id);
                  }}
                  className={`rounded-2xl p-5 min-h-[190px] text-left border transition shadow-[0_12px_35px_rgba(5,15,20,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                    activeTest === card.id
                      ? "border-emerald-300 bg-[#f3eadc] text-slate-900 shadow-[0_0_28px_rgba(52,211,153,0.2)]"
                      : "border-white/10 bg-slate-900/60 hover:border-emerald-300/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-semibold ${activeTest === card.id ? "text-slate-900" : "text-white"}`}>{card.title}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full border shadow-sm ${
                        activeTest === card.id
                          ? "border-emerald-500 bg-emerald-100 text-emerald-900 font-semibold"
                          : "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
                      }`}
                    >
                      {card.badge}
                    </span>
                  </div>
                  <p className={`text-xs mt-2 ${activeTest === card.id ? "text-slate-600" : "text-slate-300"}`}>{card.description}</p>
                  {typeof card.score === "number" && (
                    <p className={`text-xs mt-1 ${activeTest === card.id ? "text-emerald-700" : "text-emerald-300"}`}>
                      Score: {card.score}/{card.id === "pre" ? preSet.length : postSet.length}
                    </p>
                  )}
                  <div
                    className={`mt-3 text-xs ${
                      activeTest === card.id ? "text-emerald-700" : "text-emerald-200/80"
                    }`}
                  >
                    Time limit: 5 minutes
                  </div>
                  <div
                    className={`mt-2 text-xs ${
                      activeTest === card.id ? "text-slate-600" : "text-slate-400"
                    }`}
                  >
                    {card.status}
                  </div>
                  {!card.started && !((card.id === "pre" ? preSubmitted : postSubmitted)) && (
                    <div className="mt-4">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          startQuiz(card.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          event.stopPropagation();
                          startQuiz(card.id);
                        }}
                        className={`inline-flex px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                          activeTest === card.id
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-emerald-400/20 text-emerald-100 border border-emerald-400/50"
                        }`}
                      >
                        Start {card.title}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {(() => {
              const isPre = activeTest === "pre";
              const started = isPre ? preStarted : postStarted;
              const submitted = isPre ? preSubmitted : postSubmitted;
              const set = isPre ? preSet : postSet;
              const timeLeft = isPre ? preTime : postTime;
              const resetKey = isPre ? preResetKey : postResetKey;
              const title = `${isPre ? "Pre-test" : "Post-test"} (${set.length} items)`;
              const handleSubmit = isPre ? handlePreSubmit : handlePostSubmit;
              if (!started && !submitted) {
                return (
                  <div className="rounded-2xl p-6 bg-[#f7f1e7] border border-emerald-300/40 text-slate-700 shadow-[0_12px_35px_rgba(5,15,20,0.2)]">
                    <p className="text-sm font-semibold text-slate-800">
                      Click Start {isPre ? "Pre-test" : "Post-test"} to begin. The quiz will open in a focused view.
                    </p>
                    <p className="text-xs text-slate-600 mt-2">
                      Switching tabs or leaving the page will reset and randomize the questions.
                    </p>
                  </div>
                );
              }
              const quiz = (
                <Quiz
                  key={`${isPre ? "pre" : "post"}-${difficulty}-${resetKey}`}
                  title={title}
                  questions={set}
                  onSubmit={handleSubmit}
                  disabled={submitted || timeLeft <= 0}
                  timeLeft={timeLeft}
                  submitted={submitted}
                  formatTime={fmtTime}
                  reviewAnswers={isPre ? preReviewAnswers : postReviewAnswers}
                />
              );
              if (!quizInProgress) return quiz;
              return (
                <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center px-4 py-6 overflow-y-auto">
                  <div className="w-full max-w-4xl max-h-[85vh] overflow-y-auto pr-1 space-y-4">
                    <div className="flex items-center justify-between gap-3 text-white">
                      <div>
                        <h3 className="text-lg font-semibold">{isPre ? "Pre-test" : "Post-test"} in progress</h3>
                        <p className="text-xs text-emerald-100/80">
                          Leaving the page will reset and randomize the questions.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => resetQuiz(isPre ? "pre" : "post", "Quiz reset by user.")}
                        className="px-4 py-2 rounded-lg border border-white/30 text-xs hover:bg-white/10"
                      >
                        Exit &amp; Reset
                      </button>
                    </div>
                    {quiz}
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {activeTab === "feedback" && (
          <section
            id="feedback"
            className="rounded-2xl p-6 space-y-5 bg-[#f7f1e7] border border-emerald-300/40 shadow-[0_18px_55px_rgba(5,15,20,0.35)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Feedback</h3>
                <p className="text-xs text-slate-600">Share issues or improvements.</p>
              </div>
              {feedbackSaved && <span className="text-xs text-emerald-700">Saved. Thank you.</span>}
            </div>
            <form onSubmit={handleFeedbackSubmit} className="grid gap-3">
              <textarea
                value={feedbackForm.notes}
                onChange={(e) => setFeedbackForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="What should we improve..."
                className="px-4 py-3 rounded-xl bg-white border border-emerald-200/70 text-sm text-slate-900 placeholder:text-slate-400 min-h-[140px] shadow-inner"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  Keep it short and specific for faster fixes.
                </div>
                <div className="flex items-center gap-3">
                  {feedbackError && (
                    <span className="text-xs text-amber-700">{feedbackError}</span>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm"
                  >
                    Send feedback
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

      </div>

      {reviewModalOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-5xl rounded-2xl bg-[#f7f1e7] border border-emerald-300/50 shadow-[0_25px_70px_rgba(5,15,20,0.45)] p-6 space-y-5 text-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Quick Review (5 minutes)</h3>
                <p className="text-sm text-slate-700">
                  Review the alphabet before the quiz starts.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReviewActive(false);
                    setReviewSkipped(true);
                    setReviewModalOpen(false);
                    if (pendingQuiz) {
                      beginQuiz(pendingQuiz);
                      setPendingQuiz(null);
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-emerald-300 text-emerald-800"
                >
                  Skip
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-emerald-800">
              {reviewActive ? (
                <span className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200">
                  Time left: {fmtTime(reviewTime)}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200">
                  {reviewSkipped ? "Skipped" : "Ready"}
                </span>
              )}
              <span className="text-slate-600">After review, the quiz starts automatically.</span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {QUICK_REVIEW_ITEMS.map((item) => (
                  <div
                    key={item.letter}
                    className="rounded-2xl border border-emerald-200/80 bg-white/80 p-3 shadow-[0_10px_25px_rgba(5,15,20,0.2)]"
                  >
                    <div
                      className="w-full aspect-[4/3] rounded-xl border border-emerald-200/70 bg-emerald-50"
                      style={{
                        backgroundImage: `url(${quickReviewImage})`,
                        backgroundSize: `${QUICK_REVIEW_COLS * 100}% ${QUICK_REVIEW_ROWS * 100}%`,
                        backgroundPosition: `${(item.col / (QUICK_REVIEW_COLS - 1)) * 100}% ${(
                          item.row / (QUICK_REVIEW_ROWS - 1)
                        ) * 100}%`,
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                    <div className="mt-2 text-xs font-semibold text-slate-700">
                      Letter {item.letter}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {recordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-emerald-200/40 bg-slate-950/95 text-white p-6 space-y-4 shadow-[0_25px_60px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Record your own sign language</h3>
                <p className="text-xs text-emerald-100/70">
                  Record a short clip (single or double hand). This saves only to your profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecordModalOpen(false)}
                className="px-3 py-1 rounded-full border border-white/20 text-xs hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="grid md:grid-cols-[1fr_220px] gap-4">
              <div className="rounded-xl border border-emerald-200/40 overflow-hidden bg-black/40 min-h-[220px]">
                <video
                  ref={liveVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs text-emerald-100/70">Label (optional)</label>
                <select
                  value={recordLabel}
                  onChange={(e) => setRecordLabel(e.target.value)}
                  className="w-full rounded-lg border border-emerald-200/40 bg-slate-900/70 px-3 py-2 text-sm"
                >
                  <option value="">Select label</option>
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold"
                    >
                      Start
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-3 py-2 rounded-lg bg-rose-500 text-white text-sm font-semibold"
                    >
                      Stop
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveRecording}
                    disabled={!recordedBlob}
                    className="px-3 py-2 rounded-lg border border-emerald-200/40 text-sm disabled:opacity-50"
                  >
                    Save clip
                  </button>
                </div>
                {recordingStatus && (
                  <p className="text-xs text-emerald-100/80">{recordingStatus}</p>
                )}
                {recordingError && (
                  <p className="text-xs text-rose-200">{recordingError}</p>
                )}
              </div>
            </div>
            {recordedUrl && (
              <div className="space-y-2">
                <p className="text-xs text-emerald-100/70">Preview</p>
                <video src={recordedUrl} controls className="w-full rounded-xl border border-emerald-200/30 bg-black/30" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

