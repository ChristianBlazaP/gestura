import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import { getTokenRole } from "../lib/auth";

export default function AdminMonitor() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    adminUsers: 0,
    activeUsers: 0,
  });
  const [activeUsers, setActiveUsers] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [feedbackError, setFeedbackError] = useState("");
  const [activeError, setActiveError] = useState("");
  const [telemetryStats, setTelemetryStats] = useState([]);
  const [telemetryError, setTelemetryError] = useState("");
  const [demoVideos, setDemoVideos] = useState([]);
  const [demoVideoError, setDemoVideoError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState("trend");
  const [modalPanel, setModalPanel] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [statsDragging, setStatsDragging] = useState(false);
  const statsRowRef = useRef(null);
  const statsDragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  const isAdmin = getTokenRole() === "admin";
  const ACTIVE_WINDOW_MINUTES = 5;
  const DASHBOARD_REFRESH_MS = 15000;
  const STAT_SET_SIZE = 4;

  useEffect(() => {
    if (!isAdmin) {
      setError("Admin access only.");
      setLoading(false);
      return;
    }

    let alive = true;
    const load = async (opts = { silent: false }) => {
      if (!opts.silent) setLoading(true);
      setError("");
      setFeedbackError("");
      setActiveError("");
      setDemoVideoError("");
      try {
        const statsRes = await API.get("/api/admin/stats");
        if (!alive) return;
        setStats(
          statsRes.data || {
            totalUsers: 0,
            adminUsers: 0,
            activeUsers: 0,
          }
        );
        setLastUpdatedAt(new Date().toISOString());
      } catch (err) {
        if (!alive) return;
        setError(err.response?.data?.error || "Failed to load admin stats.");
      }

      try {
        const activeRes = await API.get(
          `/api/admin/active-users?minutes=${ACTIVE_WINDOW_MINUTES}`
        );
        if (!alive) return;
        setActiveUsers(activeRes.data?.users || []);
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
        const telemetryRes = await API.get("/api/telemetry/stats");
        if (!alive) return;
        setTelemetryStats(telemetryRes.data?.stats || []);
      } catch (err) {
        if (!alive) return;
        setTelemetryError("Telemetry data unavailable.");
      }

      try {
        const demoRes = await API.get("/api/admin/demo-videos");
        if (!alive) return;
        setDemoVideos(demoRes.data?.videos || []);
      } catch (err) {
        if (!alive) return;
        setDemoVideoError("Demo videos unavailable.");
      }

      if (alive && !opts.silent) setLoading(false);
    };
    load();
    const interval = setInterval(() => load({ silent: true }), DASHBOARD_REFRESH_MS);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [isAdmin]);

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

  const openPanel = (panel) => {
    if (statsDragRef.current?.suppressClick) return;
    if (panel) setActivePanel(panel);
    setModalPanel(panel || null);
  };

  const closePanel = () => {
    setModalPanel(null);
  };

  const getCenterCard = () => {
    const row = statsRowRef.current;
    if (!row) return { row: null, cards: [], closest: null };
    const cards = Array.from(row.querySelectorAll(".admin-stat-card"));
    if (!cards.length) return { row, cards, closest: null };
    const rowRect = row.getBoundingClientRect();
    const centerX = rowRect.left + rowRect.width / 2;
    let closest = cards[0];
    let closestDist = Infinity;
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const distancePx = cardCenter - centerX;
      const absPx = Math.abs(distancePx);
      if (absPx < closestDist) {
        closestDist = absPx;
        closest = card;
      }
    });

    return { row, cards, closest, rowRect };
  };

  const updateStatCardTransforms = () => {
    const { row, cards, closest, rowRect } = getCenterCard();
    if (!row || !cards.length || !closest || !rowRect) return;
    const centerX = rowRect.left + rowRect.width / 2;
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const distancePx = cardCenter - centerX;
      const absPx = Math.abs(distancePx);
      const distance = absPx / rowRect.width;
      const isCenter = card === closest;
      const boosted = Math.min(1, Math.max(0, 1 - distance * 1.2) + (isCenter ? 0.18 : 0));
      const intensity = Math.max(0, boosted);
      const scale = 0.88 + intensity * 0.14;
      const lift = 6 + intensity * 14;
      const opacity = 0.94 + intensity * 0.06;
      const borderGlow = 0.18 + intensity * 0.52;
      const shadowGlow = 0.26 + intensity * 0.6;
      const sheen = 0.08 + intensity * 0.22;
      const zIndex = Math.max(1, Math.round(140 - distance * 200));
      card.style.setProperty("--card-scale", scale.toFixed(3));
      card.style.setProperty("--card-lift", `${lift.toFixed(1)}px`);
      card.style.setProperty("--card-opacity", opacity.toFixed(3));
      card.style.setProperty("--card-border", borderGlow.toFixed(3));
      card.style.setProperty("--card-shadow", shadowGlow.toFixed(3));
      card.style.setProperty("--card-sheen", sheen.toFixed(3));
      card.style.setProperty("--card-z", `${zIndex}`);
      card.classList.toggle("is-center", isCenter);
    });
  };

  const forceCenterStats = (smooth = false) => {
    const row = statsRowRef.current;
    if (!row) return;
    const cards = Array.from(row.querySelectorAll(".admin-stat-card"));
    if (!cards.length) return;
    const targetIndex = Math.floor(cards.length / 2);
    const targetCard = cards[targetIndex];
    if (!targetCard) return;
    const targetLeft =
      targetCard.offsetLeft + targetCard.offsetWidth / 2 - row.clientWidth / 2;
    const originalBehavior = row.style.scrollBehavior;
    row.style.scrollBehavior = smooth ? "smooth" : "auto";
    row.scrollTo({ left: targetLeft, behavior: smooth ? "smooth" : "auto" });
    row.style.scrollBehavior = originalBehavior;
    updateStatCardTransforms();
  };

  const snapStatsToCenter = (smooth = false) => {
    const { row, closest } = getCenterCard();
    if (!row || !closest) return;
    const targetLeft =
      closest.offsetLeft + closest.offsetWidth / 2 - row.clientWidth / 2;
    row.scrollTo({ left: targetLeft, behavior: smooth ? "smooth" : "auto" });
    updateStatCardTransforms();
  };

  const onStatsPointerDown = (event) => {
    const el = statsRowRef.current;
    if (event.button !== 0 || !el) return;
    statsDragRef.current = {
      isDown: true,
      startX: event.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
      suppressClick: false,
      pointerId: event.pointerId,
      hasCapture: false,
      loopBlockWidth: statsDragRef.current.loopBlockWidth || 0,
      loopInitialized: statsDragRef.current.loopInitialized || false,
    };
    setStatsDragging(false);
  };

  const onStatsPointerMove = (event) => {
    const el = statsRowRef.current;
    if (!el || !statsDragRef.current.isDown) return;
    const rawDelta = event.clientX - statsDragRef.current.startX;
    if (Math.abs(rawDelta) > 2 && !statsDragRef.current.moved) {
      statsDragRef.current.moved = true;
      setStatsDragging(true);
      if (el.setPointerCapture && !statsDragRef.current.hasCapture) {
        el.setPointerCapture(statsDragRef.current.pointerId);
        statsDragRef.current.hasCapture = true;
      }
    }
    if (statsDragRef.current.moved) {
      event.preventDefault();
    }
    el.scrollLeft = statsDragRef.current.scrollLeft - rawDelta * 1.35;
  };

  const onStatsPointerEnd = () => {
    const el = statsRowRef.current;
    if (!statsDragRef.current.isDown) return;
    statsDragRef.current.isDown = false;
    if (statsDragRef.current.hasCapture && el?.releasePointerCapture) {
      el.releasePointerCapture(statsDragRef.current.pointerId);
      statsDragRef.current.hasCapture = false;
    }
    const wasMoved = statsDragRef.current.moved;
    if (wasMoved) {
      statsDragRef.current.suppressClick = true;
      setTimeout(() => {
        statsDragRef.current.suppressClick = false;
      }, 0);
    }
    setTimeout(() => {
      snapStatsToCenter();
    }, wasMoved ? 0 : 60);
    setStatsDragging(false);
  };

  const roleSegments = useMemo(() => {
    const total = Math.max(stats.totalUsers || 0, 0);
    const admins = Math.max(Math.min(stats.adminUsers || 0, total), 0);
    const users = Math.max(total - admins, 0);
    return [
      { label: "Admins", value: admins, color: "#fbbf24" },
      { label: "Users", value: users, color: "#34d399" },
    ];
  }, [stats]);

  const activeRatio = useMemo(() => {
    const total = Math.max(stats.totalUsers || 0, 0);
    if (!total) return 0;
    return Math.min((stats.activeUsers || 0) / total, 1);
  }, [stats]);

  const MiniPieChart = ({ segments, size = 88 }) => {
    const total = segments.reduce((sum, seg) => sum + seg.value, 0);
    if (!total) {
      return (
        <div className="flex items-center justify-center h-full text-[10px] text-gray-500">
          No data
        </div>
      );
    }
    let acc = 0;
    const gradientStops = segments
      .map((seg) => {
        const start = (acc / total) * 100;
        acc += seg.value;
        const end = (acc / total) * 100;
        return `${seg.color} ${start}% ${end}%`;
      })
      .join(", ");
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "999px",
          background: `conic-gradient(${gradientStops})`,
        }}
      />
    );
  };

  const lineSeries = useMemo(() => {
    const raw = Array.isArray(telemetryStats) ? telemetryStats : [];
    if (!raw.length) return [];
    const ordered = [...raw]
      .filter((row) => row && row.log_date)
      .sort((a, b) => new Date(a.log_date) - new Date(b.log_date));
    const slice = ordered.slice(-14);
    return slice.map((row) => ({
      label: row.log_date,
      value: Number(row.total_predictions || 0),
    }));
  }, [telemetryStats]);

  const trendRows = useMemo(() => {
    const raw = Array.isArray(telemetryStats) ? telemetryStats : [];
    if (!raw.length) return [];
    const ordered = [...raw]
      .filter((row) => row && row.log_date)
      .sort((a, b) => new Date(a.log_date) - new Date(b.log_date));
    return ordered.slice(-7).map((row) => {
      const avgConf = Number(row.avg_confidence);
      const avgLatency = Number(row.avg_latency_ms);
      return {
        label: row.log_date,
        total: Number(row.total_predictions || 0),
        avgConfidence: Number.isFinite(avgConf) ? avgConf.toFixed(2) : "N/A",
        avgLatency: Number.isFinite(avgLatency) ? Math.round(avgLatency) : "N/A",
        labeled: Number(row.labeled_predictions || 0),
      };
    });
  }, [telemetryStats]);

  const lineMax = useMemo(() => {
    if (!lineSeries.length) return 1;
    return Math.max(...lineSeries.map((d) => d.value), 1);
  }, [lineSeries]);

  const linePath = useMemo(() => {
    if (!lineSeries.length) return "";
    const width = 320;
    const height = 140;
    const padding = 16;
    const span = Math.max(lineSeries.length - 1, 1);
    return lineSeries
      .map((point, idx) => {
        const x = padding + (idx / span) * (width - padding * 2);
        const y =
          height -
          padding -
          (point.value / lineMax) * (height - padding * 2);
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [lineSeries, lineMax]);

  const lineAreaPath = useMemo(() => {
    if (!lineSeries.length) return "";
    const width = 320;
    const height = 140;
    const padding = 16;
    const span = Math.max(lineSeries.length - 1, 1);
    const topPath = lineSeries
      .map((point, idx) => {
        const x = padding + (idx / span) * (width - padding * 2);
        const y =
          height -
          padding -
          (point.value / lineMax) * (height - padding * 2);
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    return `${topPath} L ${width - padding} ${height - padding} L ${padding} ${
      height - padding
    } Z`;
  }, [lineSeries, lineMax]);

  useEffect(() => {
    if (loading) return;
    const timers = [
      setTimeout(() => forceCenterStats(false), 0),
      setTimeout(() => forceCenterStats(true), 160),
      setTimeout(() => forceCenterStats(true), 520),
    ];
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [
    loading,
    stats.totalUsers,
    stats.adminUsers,
    stats.activeUsers,
  ]);

  useEffect(() => {
    const row = statsRowRef.current;
    if (!row) return;
    let raf = 0;
    let snapTimer = 0;
    const updateLoopMetrics = (forceCenter = false) => {
      const cards = Array.from(row.querySelectorAll(".admin-stat-card"));
      if (cards.length < STAT_SET_SIZE) return;
      const first = cards[0];
      const last = cards[STAT_SET_SIZE - 1];
      const blockWidth =
        last.offsetLeft + last.offsetWidth - first.offsetLeft;
      if (!Number.isFinite(blockWidth) || blockWidth <= 0) return;
      statsDragRef.current.loopBlockWidth = blockWidth;
      statsDragRef.current.loopStart = first.offsetLeft;
      if (forceCenter || !statsDragRef.current.loopInitialized) {
        const centerIndex = Math.floor(STAT_SET_SIZE / 2);
        const targetCard = cards[centerIndex];
        if (targetCard) {
          const target =
            targetCard.offsetLeft + targetCard.offsetWidth / 2 - row.clientWidth / 2;
          row.scrollLeft = target;
          statsDragRef.current.loopInitialized = true;
        }
      }
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateStatCardTransforms();
      });
    };
    const handleScroll = () => {
      schedule();
      if (!statsDragRef.current.isDown) {
        if (snapTimer) clearTimeout(snapTimer);
        snapTimer = setTimeout(() => {
          snapStatsToCenter();
        }, 180);
      }
    };
    updateLoopMetrics(true);
    schedule();
    requestAnimationFrame(() => {
      updateLoopMetrics(true);
      snapStatsToCenter();
      setTimeout(() => {
        updateLoopMetrics(true);
        snapStatsToCenter();
      }, 160);
    });
    const settleTimer = setTimeout(() => {
      updateLoopMetrics(true);
      snapStatsToCenter(true);
    }, 420);
    row.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", () => {
      updateLoopMetrics(true);
      handleScroll();
    });
    return () => {
      row.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (snapTimer) clearTimeout(snapTimer);
      clearTimeout(settleTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    stats.totalUsers,
    stats.adminUsers,
    stats.activeUsers,
    lineSeries.length,
  ]);

  const renderLegend = (segments) => (
    <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-gray-300">
      {segments.map((seg) => (
        <div key={seg.label} className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: seg.color }}
          />
          <span>
            {seg.label}: {seg.value}
          </span>
        </div>
      ))}
    </div>
  );

  const renderSegmentBreakdown = (segments) => {
    const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1;
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {segments.map((seg) => {
          const pct = Math.round((seg.value / total) * 100);
          return (
            <div
              key={seg.label}
              className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{seg.label}</span>
                <span className="text-white font-semibold">{seg.value}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: seg.color }}
                />
              </div>
              <div className="mt-1 text-[11px] text-gray-500">{pct}% of total</div>
            </div>
          );
        })}
      </div>
    );
  };

  const RouletteWheel = ({ segments }) => {
    const total = segments.reduce((sum, seg) => sum + seg.value, 0);
    const [rotation, setRotation] = useState(0);
    const [wheelSize, setWheelSize] = useState(240);

    useEffect(() => {
      const updateSize = () => {
        const maxSize = 260;
        const minSize = 180;
        const next = Math.max(
          minSize,
          Math.min(maxSize, Math.floor(window.innerWidth * 0.4))
        );
        setWheelSize(next);
      };
      updateSize();
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }, []);

    const labelRadius = Math.round(wheelSize * 0.36);
    const hubSize = Math.round(wheelSize * 0.22);
    const pointerHeight = Math.round(wheelSize * 0.08);
    const pointerWidth = Math.round(wheelSize * 0.07);
    if (!total) {
      return (
        <div className="flex items-center justify-center h-44 text-sm text-gray-400">
          No data yet
        </div>
      );
    }

    let acc = 0;
    const labels = segments.map((seg) => {
      const start = (acc / total) * 360;
      acc += seg.value;
      const end = (acc / total) * 360;
      const mid = start + (end - start) / 2 - 90;
      return (
        <span
          key={seg.label}
          className="absolute left-1/2 top-1/2 text-[11px] font-semibold text-white drop-shadow pointer-events-none"
          style={{
            transform: `translate(-50%, -50%) rotate(${mid}deg) translate(${labelRadius}px) rotate(90deg)`,
          }}
        >
          {seg.label}
        </span>
      );
    });

    let startAcc = 0;
    const gradientStops = segments
      .map((seg) => {
        const start = (startAcc / total) * 100;
        startAcc += seg.value;
        const end = (startAcc / total) * 100;
        return `${seg.color} ${start}% ${end}%`;
      })
      .join(", ");

    const spinWheel = () => {
      const extraTurns = 720 + Math.floor(Math.random() * 720);
      const offset = Math.floor(Math.random() * 360);
      setRotation((prev) => prev + extraTurns + offset);
    };

    return (
      <div className="relative flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={spinWheel}
          className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-400"
          style={{ width: wheelSize, height: wheelSize }}
        >
          <div
            className="absolute inset-0 rounded-full shadow-[0_20px_60px_rgba(0,0,0,0.35)] border border-white/10"
            style={{
              background: `conic-gradient(${gradientStops})`,
              transform: `rotate(${rotation}deg)`,
              transition: "transform 2400ms cubic-bezier(0.2, 0.7, 0.2, 1)",
            }}
          >
            {labels}
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="rounded-full bg-slate-950 border border-white/15 shadow-lg"
              style={{ width: hubSize, height: hubSize }}
            />
          </div>
          <div
            className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 drop-shadow"
            style={{
              borderTop: `${pointerHeight}px solid transparent`,
              borderBottom: `${pointerHeight}px solid transparent`,
              borderLeft: `${pointerWidth}px solid #34d399`,
            }}
          />
        </button>
        <span className="text-[11px] text-gray-400">Click wheel to spin</span>
      </div>
    );
  };

  const panelTabs = [
    { id: "trend", label: "Interpreter Activity", short: "Trend" },
    { id: "roles", label: "User / Admin", short: "Roles" },
    { id: "active", label: "Active Users", short: "Active" },
    { id: "videos", label: "Demo Videos", short: "Videos" },
    { id: "feedback", label: "Feedback", short: "Feedback" },
  ];

  const PieChart = ({ segments }) => {
    const total = segments.reduce((sum, seg) => sum + seg.value, 0);
    if (!total) {
      return (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          No data yet
        </div>
      );
    }
    let acc = 0;
    const gradientStops = segments
      .map((seg) => {
        const start = (acc / total) * 100;
        acc += seg.value;
        const end = (acc / total) * 100;
        return `${seg.color} ${start}% ${end}%`;
      })
      .join(", ");
    return (
      <div
        className="w-full max-w-[220px] rounded-full mx-auto"
        style={{ aspectRatio: "1 / 1", background: `conic-gradient(${gradientStops})` }}
      />
    );
  };

  const renderPanelContent = (panel) => {
    if (panel === "trend") {
      return (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Interpreter Activity</h2>
            <span className="text-sm text-gray-400">
              Last {lineSeries.length || 0} days
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Daily total of interpreter predictions captured by telemetry.
          </p>
          {telemetryError ? (
            <p className="text-sm text-amber-300">{telemetryError}</p>
          ) : lineSeries.length === 0 ? (
            <div className="flex items-center justify-center h-44 text-sm text-gray-400">
              No telemetry yet
            </div>
          ) : (
            <svg
              viewBox="0 0 320 140"
              className="w-full h-52 md:h-60"
              preserveAspectRatio="none"
            >
              <path d={lineAreaPath} fill="rgba(16,185,129,0.15)" />
              <path
                d={linePath}
                fill="none"
                stroke="#34d399"
                strokeWidth="2"
              />
            </svg>
          )}
          {!telemetryError && trendRows.length > 0 && (
            <div className="space-y-3">
              {trendRows.map((row) => {
                const pct = Math.min((row.total / lineMax) * 100, 100);
                return (
                  <div
                    key={row.label}
                    className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 flex flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-gray-400">{row.label}</span>
                      <span className="text-white">
                        Predictions: {row.total}
                      </span>
                      <span className="text-gray-400">
                        Avg conf: {row.avgConfidence}
                      </span>
                      <span className="text-gray-400">
                        Avg latency: {row.avgLatency} ms
                      </span>
                      <span className="text-gray-500">
                        Labeled: {row.labeled}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-emerald-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="text-[11px] text-gray-500">
            Updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "-"}
          </div>
        </>
      );
    }

    if (panel === "roles") {
      return (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Role Split (Pie)</h2>
            <span className="text-sm text-gray-400">User vs Admin</span>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] items-center">
            <div className="flex justify-center">
              <PieChart segments={roleSegments} />
            </div>
            {renderSegmentBreakdown(roleSegments)}
          </div>
          {renderLegend(roleSegments)}
          <div className="text-[11px] text-gray-500">
            Updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "-"}
          </div>
        </>
      );
    }

    if (panel === "active") {
      return (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Active Users (last {ACTIVE_WINDOW_MINUTES} min)
            </h2>
            <span className="text-sm text-gray-400">
              {activeUsers.length} online
            </span>
          </div>
          {activeError && (
            <p className="text-sm text-amber-300">{activeError}</p>
          )}
          {!activeError && activeUsers.length === 0 && (
            <p className="text-sm text-gray-400">
              No active users right now.
            </p>
          )}
          {!activeError && activeUsers.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3">
              {activeUsers.slice(0, 12).map((user) => (
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
          <div className="text-[11px] text-gray-500">
            Updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "-"}
          </div>
        </>
      );
    }

    if (panel === "videos") {
      return (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Demo Videos</h2>
            <span className="text-sm text-gray-400">
              {demoVideos.length} videos
            </span>
          </div>
          {demoVideoError && (
            <p className="text-sm text-amber-300">{demoVideoError}</p>
          )}
          {!demoVideoError && demoVideos.length === 0 && (
            <p className="text-sm text-gray-400">No demo videos yet.</p>
          )}
          {!demoVideoError && demoVideos.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3">
              {demoVideos.slice(0, 8).map((video) => (
                <div
                  key={video.id}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3"
                >
                  <div className="font-semibold text-white">{video.letter}</div>
                  <div className="text-xs text-gray-400">{video.youtube_url}</div>
                </div>
              ))}
            </div>
          )}
          <div className="text-[11px] text-gray-500">
            Updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "-"}
          </div>
        </>
      );
    }

    if (panel === "feedback") {
      return (
        <>
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
          <div className="text-[11px] text-gray-500">
            Updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "-"}
          </div>
        </>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="app-shell text-gray-100 flex items-center justify-center">
        Loading admin monitor...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="app-shell text-gray-100 flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold">Admin access only.</p>
        <button
          onClick={() => navigate("/home")}
          className="btn-secondary px-4 py-2 rounded-lg text-sm"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const statCardDefs = [
    {
      id: "trend",
      title: "Total users",
      value: stats.totalUsers,
      body: (
        <>
          <p className="text-[10px] text-emerald-300 mt-3 opacity-0 group-hover:opacity-100 transition">
            View dashboards
          </p>
          <div className="mt-4 h-16">
            {lineSeries.length === 0 ? (
              <div className="h-full flex items-center text-[10px] text-gray-500">
                No telemetry
              </div>
            ) : (
              <svg
                viewBox="0 0 320 140"
                className="w-full h-full opacity-75 group-hover:opacity-100 transition"
                preserveAspectRatio="none"
              >
                <path d={lineAreaPath} fill="rgba(16,185,129,0.18)" />
                <path d={linePath} fill="none" stroke="#34d399" strokeWidth="2" />
              </svg>
            )}
          </div>
        </>
      ),
    },
    {
      id: "roles",
      title: "Admin accounts",
      value: stats.adminUsers,
      body: (
        <>
          <p className="text-[10px] text-emerald-300 mt-3 opacity-0 group-hover:opacity-100 transition">
            View dashboards
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-[10px] text-gray-500">
              Users: {Math.max((stats.totalUsers || 0) - (stats.adminUsers || 0), 0)}
            </div>
            <div className="opacity-80 group-hover:opacity-100 transition">
              <MiniPieChart segments={roleSegments} />
            </div>
          </div>
        </>
      ),
    },
    {
      id: "active",
      title: "Active now (last 5 min)",
      value: stats.activeUsers,
      body: (
        <>
          <p className="text-[10px] text-emerald-300 mt-3 opacity-0 group-hover:opacity-100 transition">
            View dashboards
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>Active</span>
              <span>
                {Math.round(activeRatio * 100)}% of {stats.totalUsers}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-emerald-400 transition-all"
                style={{ width: `${Math.round(activeRatio * 100)}%` }}
              />
            </div>
          </div>
        </>
      ),
    },
    {
      id: "videos",
      title: "Demo videos",
      value: demoVideos.length,
      body: (
        <>
          <p className="text-[10px] text-emerald-300 mt-3 opacity-0 group-hover:opacity-100 transition">
            View dashboards
          </p>
          <div className="mt-3 text-[10px] text-gray-500">
            Latest: {demoVideos[0]?.letter || "None"}
          </div>
        </>
      ),
    },
  ];
  const statCards = statCardDefs.map((card) => ({ ...card, key: card.id }));

  return (
    <div className="app-shell text-white">
      <header className="app-header sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/home")}
              className="btn-ghost px-3 py-1.5 rounded-lg text-sm"
            >
              Back
            </button>
            <div className="font-bold tracking-wide">GESTURA Admin Monitor</div>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/home" className="nav-link">
              Home
            </Link>
            <Link to="/learnings" className="nav-link">
              Learnings
            </Link>
            <Link to="/profile" className="nav-link">
              Profile
            </Link>
            <Link to="/admin/manage" className="nav-link">
              Admin Tools
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

        <section
          className={`admin-stat-shell ${statsDragging ? "is-dragging" : ""}`}
          onPointerDown={onStatsPointerDown}
          onPointerMove={onStatsPointerMove}
          onPointerUp={onStatsPointerEnd}
          onPointerLeave={onStatsPointerEnd}
          onPointerCancel={onStatsPointerEnd}
        >
          <div
            ref={statsRowRef}
            className={`admin-stat-scroll ${statsDragging ? "is-dragging" : ""}`}
          >
            {statCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => openPanel(card.id)}
                className="surface-card admin-stat-card text-left p-6 transition hover:-translate-y-0.5 hover:border-emerald-400/40 hover:bg-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-400 group"
              >
                <p className="text-sm text-gray-400">{card.title}</p>
                <p className="text-3xl font-bold">{card.value}</p>
                {card.body}
              </button>
            ))}
          </div>
        </section>
      </main>

      {modalPanel && (
        <div className="admin-modal-overlay" onClick={closePanel}>
          <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={closePanel}
              className="admin-modal-close"
              aria-label="Close dashboard panel"
            >
              Close
            </button>
            <div className="admin-modal-body">
              {renderPanelContent(modalPanel)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
