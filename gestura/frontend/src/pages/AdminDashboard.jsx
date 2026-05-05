import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import { getTokenRole } from "../lib/auth";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const emptyLearning = {
    totals: {
      attempts: 0,
      avgScore: null,
      learners: 0,
      modulesTouched: 0,
    },
    perUser: [],
    perModule: [],
  };
  const emptyAssessment = {
    totals: {
      attempts: 0,
      avgScore: null,
      learners: 0,
    },
    byType: {},
  };
  const [stats, setStats] = useState({
    totalUsers: 0,
    adminUsers: 0,
    activeUsers: 0,
  });
  const [users, setUsers] = useState([]);
  const [learningStats, setLearningStats] = useState(emptyLearning);
  const [learningError, setLearningError] = useState("");
  const [assessmentStats, setAssessmentStats] = useState(emptyAssessment);
  const [assessmentError, setAssessmentError] = useState("");
  const [assessmentUsers, setAssessmentUsers] = useState([]);
  const [assessmentUsersError, setAssessmentUsersError] = useState("");
  const [assessmentQuestions, setAssessmentQuestions] = useState({
    pre: [],
    post: [],
  });
  const [assessmentQuestionsError, setAssessmentQuestionsError] = useState("");
  const [assessmentTypeTab, setAssessmentTypeTab] = useState("pre");
  const [questionForm, setQuestionForm] = useState({
    type: "pre",
    question: "",
    choiceA: "",
    choiceB: "",
    choiceC: "",
    choiceD: "",
    correctAnswer: "",
  });
  const [demoVideos, setDemoVideos] = useState([]);
  const [demoVideoError, setDemoVideoError] = useState("");
  const [demoVideoForm, setDemoVideoForm] = useState({
    label: "",
    url: "",
  });
  const [demoVideoFile, setDemoVideoFile] = useState(null);
  const [demoVideoMode, setDemoVideoMode] = useState("file");
  const [demoVideoStatus, setDemoVideoStatus] = useState("");
  const [demoVideoCategory, setDemoVideoCategory] = useState("ASL");
  const [gestureRecords, setGestureRecords] = useState([]);
  const [gestureError, setGestureError] = useState("");
  const [feedback, setFeedback] = useState([]);
  const [feedbackError, setFeedbackError] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);
  const [activeError, setActiveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const ACTIVE_WINDOW_MINUTES = 5;

  const isAdmin = getTokenRole() === "admin";

  useEffect(() => {
    if (!isAdmin) {
      setError("Admin access only.");
      setLoading(false);
      return;
    }

    let alive = true;
    const load = async () => {
      setLoading(true);
      setError("");
      setFeedbackError("");
      setGestureError("");
      setLearningError("");
      setAssessmentError("");
      setAssessmentUsersError("");
      setAssessmentQuestionsError("");
      setDemoVideoError("");
      try {
        const [statsRes, usersRes] = await Promise.all([
          API.get("/api/admin/stats"),
          API.get("/api/admin/users"),
        ]);
        if (!alive) return;
        setStats(
          statsRes.data || {
            totalUsers: 0,
            adminUsers: 0,
            activeUsers: 0,
          }
        );
        setUsers(usersRes.data?.users || []);
      } catch (err) {
        if (!alive) return;
        setError(err.response?.data?.error || "Failed to load admin data.");
      }

      try {
        const learningRes = await API.get("/api/admin/learning-stats");
        if (!alive) return;
        setLearningStats(learningRes.data || emptyLearning);
        setLearningError("");
      } catch (err) {
        if (!alive) return;
        setLearningError("Learning analytics unavailable.");
        setLearningStats(emptyLearning);
      }

      try {
        const assessmentRes = await API.get("/api/admin/assessment-stats");
        if (!alive) return;
        setAssessmentStats(assessmentRes.data || emptyAssessment);
        setAssessmentError("");
      } catch (err) {
        if (!alive) return;
        setAssessmentError("Assessment analytics unavailable.");
        setAssessmentStats(emptyAssessment);
      }

      try {
        const assessmentUsersRes = await API.get("/api/admin/assessment-users");
        if (!alive) return;
        setAssessmentUsers(assessmentUsersRes.data?.users || []);
      } catch (err) {
        if (!alive) return;
        setAssessmentUsersError("Assessment users unavailable.");
        setAssessmentUsers([]);
      }

      try {
        const activeRes = await API.get(
          `/api/admin/active-users?minutes=${ACTIVE_WINDOW_MINUTES}`
        );
        if (!alive) return;
        setActiveUsers(activeRes.data?.users || []);
        setActiveError("");
      } catch (err) {
        if (!alive) return;
        setActiveError("Active users list unavailable.");
      }

      try {
        const feedbackRes = await API.get("/api/feedback");
        if (!alive) return;
        setFeedback(feedbackRes.data?.feedback || []);
      } catch (err) {
        if (!alive) return;
        setFeedbackError("Feedback list unavailable.");
      }

      try {
        const [preRes, postRes] = await Promise.all([
          API.get("/api/admin/assessment-questions?type=pre"),
          API.get("/api/admin/assessment-questions?type=post"),
        ]);
        if (!alive) return;
        setAssessmentQuestions({
          pre: preRes.data?.questions || [],
          post: postRes.data?.questions || [],
        });
      } catch (err) {
        if (!alive) return;
        setAssessmentQuestionsError("Assessment questions unavailable.");
      }

      try {
        const demoRes = await API.get("/api/admin/demo-videos");
        if (!alive) return;
        setDemoVideos(demoRes.data?.videos || []);
      } catch (err) {
        if (!alive) return;
        setDemoVideoError("Demo videos unavailable.");
      }

      try {
        const gestureRes = await API.get("/api/admin/gesture-records?limit=100");
        if (!alive) return;
        setGestureRecords(gestureRes.data?.records || []);
      } catch (err) {
        if (!alive) return;
        setGestureError("Gesture records unavailable.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();

    return () => {
      alive = false;
    };
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const full = `${u.firstname || ""} ${u.lastname || ""}`.toLowerCase();
      return (
        full.includes(term) ||
        (u.email || "").toLowerCase().includes(term) ||
        (u.username || "").toLowerCase().includes(term)
      );
    });
  }, [users, query]);

  useEffect(() => {
    const firstUser = assessmentUsers?.[0];
    if (!firstUser) return;
    setSelectedUserId((prev) =>
      prev ? prev : String(firstUser.user_id || "")
    );
  }, [assessmentUsers]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return (assessmentUsers || []).find(
      (row) => String(row.user_id) === String(selectedUserId)
    );
  }, [assessmentUsers, selectedUserId]);

  useEffect(() => {
    setQuestionForm((prev) => ({ ...prev, type: assessmentTypeTab }));
  }, [assessmentTypeTab]);

  const formatScore = (value) => {
    if (value === null || value === undefined) return "N/A";
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return "N/A";
    return parsed.toFixed(1);
  };

  const handleDemoVideoSubmit = async (event) => {
    event.preventDefault();
    const fallbackLabel = `${demoVideoCategory} Alphabet Demo`;
    const label = demoVideoForm.label.trim() || fallbackLabel;
    const url = demoVideoForm.url.trim();
    if (!label) return;
    if (demoVideoMode === "file" && !demoVideoFile) return;
    if (demoVideoMode === "url" && !url) return;
    setDemoVideoError("");
    setDemoVideoStatus(demoVideoMode === "file" ? "Uploading..." : "Saving...");
    try {
      if (demoVideoMode === "file") {
        const formData = new FormData();
        formData.append("label", label);
        formData.append("video", demoVideoFile);
        await API.post("/api/admin/demo-videos/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await API.post("/api/admin/demo-videos", {
          letter: label,
          youtube_url: url,
        });
      }
      const demoRes = await API.get("/api/admin/demo-videos");
      setDemoVideos(demoRes.data?.videos || []);
      setDemoVideoForm({ label: "", url: "" });
      setDemoVideoFile(null);
      setDemoVideoCategory("ASL");
      setDemoVideoStatus("Saved.");
      setTimeout(() => setDemoVideoStatus(""), 2000);
    } catch (err) {
      setDemoVideoError(err.response?.data?.error || "Failed to add demo video.");
      setDemoVideoStatus("");
    }
  };

  const handleDemoVideoDelete = async (id) => {
    setDemoVideoError("");
    try {
      await API.delete(`/api/admin/demo-videos/${id}`);
      setDemoVideos((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setDemoVideoError(err.response?.data?.error || "Failed to delete demo video.");
    }
  };

  const handleQuestionSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      type: questionForm.type,
      question: questionForm.question.trim(),
      choices: [
        questionForm.choiceA.trim(),
        questionForm.choiceB.trim(),
        questionForm.choiceC.trim(),
        questionForm.choiceD.trim(),
      ],
      correct_answer: questionForm.correctAnswer.trim(),
    };
    if (
      !payload.question ||
      payload.choices.some((choice) => !choice) ||
      !payload.correct_answer
    ) {
      return;
    }
    setAssessmentQuestionsError("");
    try {
      await API.post("/api/admin/assessment-questions", payload);
      const res = await API.get(
        `/api/admin/assessment-questions?type=${questionForm.type}`
      );
      setAssessmentQuestions((prev) => ({
        ...prev,
        [questionForm.type]: res.data?.questions || [],
      }));
      setQuestionForm((prev) => ({
        ...prev,
        question: "",
        choiceA: "",
        choiceB: "",
        choiceC: "",
        choiceD: "",
        correctAnswer: "",
      }));
    } catch (err) {
      setAssessmentQuestionsError(
        err.response?.data?.error || "Failed to add assessment question."
      );
    }
  };

  const handleQuestionDelete = async (id, type) => {
    setAssessmentQuestionsError("");
    try {
      await API.delete(`/api/admin/assessment-questions/${id}`);
      setAssessmentQuestions((prev) => ({
        ...prev,
        [type]: prev[type].filter((item) => item.id !== id),
      }));
    } catch (err) {
      setAssessmentQuestionsError(
        err.response?.data?.error || "Failed to delete question."
      );
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  };

  const parseGestureMeta = (raw) => {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed?.metadata || {};
    } catch {
      return {};
    }
  };

  const formatAgo = (value) => {
    if (!value) return "Never";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "Never";
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 60 * 1000) return "Just now";
    if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const updateRole = async (id, nextRole) => {
    setSavingId(id);
    setError("");
    try {
      const res = await API.put(`/api/admin/users/${id}/role`, { role: nextRole });
      const updatedRole = res.data?.role || nextRole;
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: updatedRole } : u))
      );
      setStats((prev) => {
        const adminCount = prev.adminUsers + (updatedRole === "admin" ? 1 : -1);
        return { ...prev, adminUsers: Math.max(adminCount, 0) };
      });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update role.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-gray-100 flex items-center justify-center">
        Loading admin dashboard...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-gray-100 flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold">Admin access only.</p>
        <button
          onClick={() => navigate("/home")}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-white">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/home")}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-sm text-gray-300 hover:text-white hover:bg-white/10"
            >
              Back
            </button>
            <div className="font-bold tracking-wide">GESTURA Admin Tools</div>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/home" className="text-gray-300 hover:text-white">
              Home
            </Link>
            <Link to="/learnings" className="text-gray-300 hover:text-white">
              Learnings
            </Link>
            <Link to="/profile" className="text-gray-300 hover:text-white">
              Profile
            </Link>
            <Link to="/admin" className="text-gray-300 hover:text-white">
              Monitor
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {error && (
          <div className="border border-red-400/40 bg-red-500/10 text-red-200 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "admin-analytics", label: "Data Analytics" },
              { id: "admin-users", label: "User Management" },
              { id: "admin-demo", label: "Demo Videos" },
              { id: "admin-assessments", label: "Assessment Questions" },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="px-3 py-1.5 rounded-full text-xs border border-white/10 bg-white/5 text-gray-200 hover:border-emerald-400/60 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-gray-400">Total users</p>
            <p className="text-3xl font-bold">{stats.totalUsers}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-gray-400">Admin accounts</p>
            <p className="text-3xl font-bold">{stats.adminUsers}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-gray-400">Active now (last 5 min)</p>
            <p className="text-3xl font-bold">{stats.activeUsers}</p>
          </div>
        </section>

        <section id="admin-analytics" className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Data Analytics</h2>
              <p className="text-xs text-gray-400">
                System-wide learning + assessment performance
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[11px] text-gray-400">Learning attempts</p>
              <p className="text-2xl font-semibold text-white">
                {learningStats.totals?.attempts || 0}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[11px] text-gray-400">Learners</p>
              <p className="text-2xl font-semibold text-white">
                {learningStats.totals?.learners || 0}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[11px] text-gray-400">Modules touched</p>
              <p className="text-2xl font-semibold text-white">
                {learningStats.totals?.modulesTouched || 0}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[11px] text-gray-400">Learning avg score</p>
              <p className="text-2xl font-semibold text-white">
                {learningStats.totals?.avgScore !== null &&
                Number.isFinite(learningStats.totals?.avgScore) &&
                (learningStats.totals?.attempts || 0) > 0
                  ? Number(learningStats.totals.avgScore).toFixed(1)
                  : "N/A"}
              </p>
            </div>
          </div>
          {learningError && (
            <p className="text-sm text-amber-300">{learningError}</p>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <h3 className="font-semibold text-white">Assessments (Pre/Post)</h3>
                  <p className="text-[11px] text-gray-400">
                    System overview across all users
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  Attempts: {assessmentStats.totals?.attempts || 0}
                </span>
              </div>
              {assessmentError ? (
                <p className="text-sm text-amber-300">{assessmentError}</p>
              ) : (
                <>
                  <div className="text-xs text-gray-400">
                    Learners: {assessmentStats.totals?.learners || 0} | Avg:{" "}
                    {assessmentStats.totals?.avgScore !== null &&
                    Number.isFinite(assessmentStats.totals?.avgScore) &&
                    (assessmentStats.totals?.attempts || 0) > 0
                      ? Number(assessmentStats.totals.avgScore).toFixed(1)
                      : "N/A"}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {["pre", "post"].map((type) => {
                      const block = assessmentStats.byType?.[type];
                      if (!block) {
                        return (
                          <div
                            key={type}
                            className="rounded-lg border border-white/10 bg-slate-950/70 p-3 text-[11px] text-gray-400"
                          >
                            {type.toUpperCase()} - No data
                          </div>
                        );
                      }
                      const diff = block.byDifficulty || {};
                      return (
                        <div
                          key={type}
                          className="rounded-lg border border-white/10 bg-slate-950/70 p-3 text-[11px]"
                        >
                          <div className="font-semibold text-gray-200">
                            {type.toUpperCase()} - {block.attempts} attempts
                          </div>
                          <div className="mt-1 text-gray-400">
                            Avg:{" "}
                            {block.avgScore !== null && Number.isFinite(block.avgScore)
                              ? Number(block.avgScore).toFixed(1)
                              : "N/A"}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-gray-400">
                            {["easy", "medium", "hard"].map((level) => (
                              <span key={level}>
                                {level}: {diff[level]?.attempts || 0}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">User Analytics</h3>
                    <p className="text-[11px] text-gray-400">
                      Assessment summary for a selected user
                    </p>
                  </div>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="bg-slate-950/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    {(assessmentUsers || []).map((user) => {
                      const name = `${user.firstname || ""} ${user.lastname || ""}`.trim();
                      const label = name || user.username || user.email || `User ${user.user_id}`;
                      return (
                        <option key={user.user_id} value={user.user_id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {assessmentUsersError ? (
                  <p className="text-sm text-amber-300">{assessmentUsersError}</p>
                ) : !selectedUser ? (
                  <p className="text-sm text-gray-400">No assessment data yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-slate-950/70 p-3">
                      <p className="text-[11px] text-gray-400">Attempts</p>
                      <p className="text-lg font-semibold text-white">
                        {Number(selectedUser.attempts || 0)}
                      </p>
                      {Number(selectedUser.attempts || 0) === 0 && (
                        <p className="mt-1 text-[11px] text-gray-500">
                          No assessment attempts yet.
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-slate-950/70 p-3">
                      <p className="text-[11px] text-gray-400">Avg score</p>
                      <p className="text-lg font-semibold text-white">
                        {formatScore(selectedUser.avg_score)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Active Users (last {ACTIVE_WINDOW_MINUTES} min)
                  </h3>
                  <span className="text-xs text-gray-400">
                    {activeUsers.length} online
                  </span>
                </div>
                {activeError && (
                  <p className="text-sm text-amber-300">{activeError}</p>
                )}
                {!activeError && activeUsers.length === 0 && (
                  <p className="text-sm text-gray-400">No active users right now.</p>
                )}
                {!activeError && activeUsers.length > 0 && (
                  <div className="grid gap-3">
                    {activeUsers.slice(0, 6).map((user) => (
                      <div
                        key={user.id}
                        className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3"
                      >
                        <div className="font-semibold text-white">
                          {user.firstname} {user.lastname}
                        </div>
                        <div className="text-xs text-gray-400">@{user.username}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Last seen: {formatAgo(user.last_seen)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="admin-users" className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">User Management</h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, username, or email"
              className="w-full md:w-72 px-3 py-2 rounded-lg bg-slate-950/70 border border-white/15 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400 border-b border-white/10">
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Verified</th>
                  <th className="py-2">Created</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  return (
                    <tr key={u.id} className="border-b border-white/5">
                      <td className="py-3">
                        <div className="font-medium text-white">
                          {u.firstname} {u.lastname}
                        </div>
                        <div className="text-[11px] text-gray-500">@{u.username}</div>
                      </td>
                      <td className="py-3 text-gray-300">{u.email}</td>
                      <td className="py-3">
                        <select
                          value={u.role}
                          onChange={(e) => updateRole(u.id, e.target.value)}
                          disabled={savingId === u.id}
                          className="bg-slate-950/80 border border-white/10 rounded-lg px-2 py-1 text-sm text-white"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="py-3 text-gray-300">
                        {u.email_verified ? "Yes" : "No"}
                      </td>
                      <td className="py-3 text-gray-400">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="py-3 text-right text-gray-400">
                        {savingId === u.id ? "Saving..." : ""}
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="admin-demo" className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Demo Videos</h2>
            <span className="text-xs text-gray-400">Manage learning demos</span>
          </div>
          {demoVideoError && (
            <p className="text-sm text-amber-300">{demoVideoError}</p>
          )}
          <form
            onSubmit={handleDemoVideoSubmit}
            className="grid gap-3 md:grid-cols-[minmax(0,140px)_minmax(0,200px)_minmax(0,1fr)_auto]"
          >
            <select
              value={demoVideoCategory}
              onChange={(e) => setDemoVideoCategory(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-950/70 border border-white/15 text-sm text-white"
            >
              <option value="ASL">ASL</option>
              <option value="FSL">FSL</option>
            </select>
            <input
              value={demoVideoForm.label}
              onChange={(e) =>
                setDemoVideoForm((prev) => ({ ...prev, label: e.target.value }))
              }
              placeholder={`Label (default: ${demoVideoCategory} Alphabet Demo)`}
              className="px-3 py-2 rounded-lg bg-slate-950/70 border border-white/15 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <div className="rounded-lg border border-white/15 bg-slate-950/70 p-2">
              <div className="flex flex-wrap items-center gap-2">
                {["file", "url"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDemoVideoMode(mode)}
                    className={`px-3 py-1 rounded-full text-[11px] border ${
                      demoVideoMode === mode
                        ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                        : "border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    {mode === "file" ? "Upload file" : "Paste URL"}
                  </button>
                ))}
              </div>
              {demoVideoMode === "file" ? (
                <div className="mt-2 flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-xs text-emerald-100 cursor-pointer">
                    <span>Choose file</span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/ogg,video/quicktime"
                      onChange={(e) => setDemoVideoFile(e.target.files?.[0] || null)}
                      className="sr-only"
                    />
                  </label>
                  <span className="text-[11px] text-gray-400">
                    {demoVideoFile ? demoVideoFile.name : "No file selected"}
                  </span>
                  {demoVideoFile && (
                    <button
                      type="button"
                      onClick={() => setDemoVideoFile(null)}
                      className="ml-auto text-[11px] text-rose-200 hover:text-rose-100"
                    >
                      Clear
                    </button>
                  )}
                </div>
              ) : (
                <input
                  value={demoVideoForm.url}
                  onChange={(e) =>
                    setDemoVideoForm((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="https://..."
                  className="mt-2 w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-500/80 text-slate-950 text-sm font-semibold hover:bg-emerald-400"
            >
              Add video
            </button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
            <span>Uploads are stored on the server and visible to users.</span>
            {demoVideoStatus && (
              <span className="text-emerald-200">{demoVideoStatus}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400 border-b border-white/10">
                <tr>
                  <th className="py-2">Label</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">URL</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {demoVideos.map((video) => {
                  const label = video.letter || "";
                  const normalized = label.toLowerCase();
                  const type = normalized.startsWith("asl")
                    ? "ASL"
                    : normalized.startsWith("fsl")
                    ? "FSL"
                    : "Custom";
                  return (
                    <tr key={video.id} className="border-b border-white/5">
                      <td className="py-3 text-gray-200">{label}</td>
                      <td className="py-3 text-gray-400">{type}</td>
                      <td className="py-3 text-gray-400">{video.youtube_url}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDemoVideoDelete(video.id)}
                          className="text-xs text-rose-200 hover:text-rose-100"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {demoVideos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-500">
                      No demo videos yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="admin-assessments" className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Assessment Questions</h2>
            <div className="flex gap-2">
              {["pre", "post"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAssessmentTypeTab(type)}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    assessmentTypeTab === type
                      ? "border-emerald-300/70 bg-emerald-500/20 text-emerald-100"
                      : "border-white/10 bg-white/5 text-gray-300 hover:text-white"
                  }`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {assessmentQuestionsError && (
            <p className="text-sm text-amber-300">{assessmentQuestionsError}</p>
          )}
          <form
            onSubmit={handleQuestionSubmit}
            className="grid gap-3 lg:grid-cols-2"
          >
            <div className="space-y-3">
              <input
                value={questionForm.question}
                onChange={(e) =>
                  setQuestionForm((prev) => ({ ...prev, question: e.target.value }))
                }
                placeholder="Question"
                className="w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-white/15 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  value={questionForm.choiceA}
                  onChange={(e) =>
                    setQuestionForm((prev) => ({ ...prev, choiceA: e.target.value }))
                  }
                  placeholder="Choice A"
                  className="px-3 py-2 rounded-lg bg-slate-950/70 border border-white/15 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <input
                  value={questionForm.choiceB}
                  onChange={(e) =>
                    setQuestionForm((prev) => ({ ...prev, choiceB: e.target.value }))
                  }
                  placeholder="Choice B"
                  className="px-3 py-2 rounded-lg bg-slate-950/70 border border-white/15 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <input
                  value={questionForm.choiceC}
                  onChange={(e) =>
                    setQuestionForm((prev) => ({ ...prev, choiceC: e.target.value }))
                  }
                  placeholder="Choice C"
                  className="px-3 py-2 rounded-lg bg-slate-950/70 border border-white/15 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <input
                  value={questionForm.choiceD}
                  onChange={(e) =>
                    setQuestionForm((prev) => ({ ...prev, choiceD: e.target.value }))
                  }
                  placeholder="Choice D"
                  className="px-3 py-2 rounded-lg bg-slate-950/70 border border-white/15 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>
            <div className="space-y-3">
              <select
                value={questionForm.correctAnswer}
                onChange={(e) =>
                  setQuestionForm((prev) => ({
                    ...prev,
                    correctAnswer: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-white/15 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">Select correct answer</option>
                {[questionForm.choiceA, questionForm.choiceB, questionForm.choiceC, questionForm.choiceD]
                  .filter(Boolean)
                  .map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg bg-emerald-500/80 text-slate-950 text-sm font-semibold hover:bg-emerald-400"
              >
                Add {assessmentTypeTab.toUpperCase()} question
              </button>
            </div>
          </form>
          <div className="space-y-2">
            {(assessmentQuestions[assessmentTypeTab] || []).map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white">{item.question}</p>
                  <button
                    type="button"
                    onClick={() => handleQuestionDelete(item.id, assessmentTypeTab)}
                    className="text-xs text-rose-200 hover:text-rose-100"
                  >
                    Delete
                  </button>
                </div>
                <div className="text-xs text-gray-400">
                  Correct: {item.correct_answer}
                </div>
              </div>
            ))}
            {(assessmentQuestions[assessmentTypeTab] || []).length === 0 && (
              <p className="text-sm text-gray-500">
                No {assessmentTypeTab.toUpperCase()} questions yet.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Recorded Gestures</h2>
            <span className="text-xs text-gray-400">
              Latest {gestureRecords.length} samples
            </span>
          </div>
          {gestureError && <p className="text-sm text-amber-300">{gestureError}</p>}
          {!gestureError && gestureRecords.length === 0 && (
            <p className="text-sm text-gray-400">No gesture samples yet.</p>
          )}
          {!gestureError && gestureRecords.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="py-2">User</th>
                    <th className="py-2">Label</th>
                    <th className="py-2">Hand</th>
                    <th className="py-2">Score</th>
                    <th className="py-2">Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {gestureRecords.map((rec) => {
                    const meta = parseGestureMeta(rec.landmarks_json);
                    const userName = `${rec.firstname || ""} ${rec.lastname || ""}`.trim();
                    return (
                      <tr key={rec.id} className="border-b border-white/5">
                        <td className="py-3 text-gray-200">
                          <div className="font-medium text-white">
                            {userName || rec.username}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {rec.email || rec.username}
                          </div>
                        </td>
                        <td className="py-3 text-emerald-200 font-semibold">
                          {rec.label}
                        </td>
                        <td className="py-3 text-gray-300">
                          {meta.handedness || "-"}
                        </td>
                        <td className="py-3 text-gray-300">
                          {meta.score !== undefined && meta.score !== null
                            ? Number(meta.score).toFixed(2)
                            : "-"}
                        </td>
                        <td className="py-3 text-gray-400">
                          {formatDateTime(rec.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-xl font-semibold">Feedback Inbox</h2>
          {feedbackError && (
            <p className="text-sm text-amber-300">{feedbackError}</p>
          )}
          {!feedbackError && feedback.length === 0 && (
            <p className="text-sm text-gray-400">No feedback yet.</p>
          )}
          {!feedbackError && feedback.length > 0 && (
            <div className="space-y-3">
              {feedback.slice(0, 20).map((item) => (
                <div
                  key={item.id}
                  className="border border-white/10 rounded-xl p-4 bg-slate-950/50"
                >
                  <div className="text-sm text-gray-400">
                    {item.firstname} {item.lastname} - {item.email}
                  </div>
                  <p className="text-sm text-gray-100 mt-2">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
