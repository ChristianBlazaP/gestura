// src/pages/ProfilePage.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { getTokenRole } from "../lib/auth";

export default function ProfilePage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [activeError, setActiveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [bioDraft, setBioDraft] = useState("");
  const [bioMsg, setBioMsg] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [feedItems, setFeedItems] = useState([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingOutgoing, setPendingOutgoing] = useState(new Set());
  const [coverUrl, setCoverUrl] = useState(
    "https://images.unsplash.com/photo-1503264116251-35a269479413?auto=format&fit=crop&w=1400&q=80"
  );
  const [avatarUrl, setAvatarUrl] = useState("");
  const [pendingFileName, setPendingFileName] = useState("");
  const [likedIds, setLikedIds] = useState(new Set());
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState("");
  const [recoveryErr, setRecoveryErr] = useState("");
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [viewUserPhotos, setViewUserPhotos] = useState([]);
  const [viewUserLiked, setViewUserLiked] = useState(new Set());
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const feedFileRef = useRef(null);
  const isAdmin = (profile?.role || getTokenRole()) === "admin";

  const normalizeUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API.defaults.baseURL || ""}${url}`;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    const load = async () => {
      try {
        const res = await API.get("/api/profile");
        setProfile(res.data.user);
        setFriends(res.data.friends || []);
        setBioDraft(res.data.user?.bio || "");
        setRecoveryEmail(res.data.user?.recovery_email || "");
        setRecoveryVerified(Boolean(res.data.user?.recovery_email_verified));
        setCoverUrl(normalizeUrl(res.data.user?.cover_url) || coverUrl);
        setAvatarUrl(normalizeUrl(res.data.user?.avatar_url) || "");
        const photosRes = await API.get("/api/profile/photos");
        const mapped = (photosRes.data?.photos || []).map((p) => ({
          ...p,
          url: normalizeUrl(p.url),
        }));
        setFeedItems(mapped);
        setLikedIds(new Set(photosRes.data?.liked || []));
        let activeList = [];
        try {
          const activeRes = await API.get("/api/users/active");
          activeList = activeRes.data?.users || [];
          setActiveError("");
        } catch (err) {
          // Fallback: try a general users listing if /active is missing
          try {
            const fallbackRes = await API.get("/api/users");
            activeList = fallbackRes.data?.users || [];
            setActiveError("");
          } catch (innerErr) {
            console.error("Active users load failed:", err, innerErr);
            activeList = [];
            setActiveError("Active users unavailable right now.");
          }
        }
        setActiveUsers(activeList);
        await refreshFriends(res.data.user?.id);
        setLoading(false);
      } catch (err) {
        console.error("Profile load failed:", err);
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  async function refreshFriends(userId) {
    if (!userId) return;
    try {
      const res = await API.get("/api/profile");
      setFriends(res.data.friends || []);
    } catch {
      /* ignore */
    }
    try {
      const reqRes = await API.get(`/api/friends/requests/${userId}`);
      setPendingRequests(reqRes.data?.requests || []);
    } catch {
      setPendingRequests([]);
    }
    try {
      const outRes = await API.get(`/api/friends/pending/${userId}`);
      const outIds = new Set((outRes.data?.outgoing || []).map((o) => o.target_id));
      setPendingOutgoing(outIds);
    } catch {
      setPendingOutgoing(new Set());
    }
  }

  async function loadViewUserPhotos(userId) {
    try {
      const res = await API.get(`/api/profile/photos/${userId}`);
      const mapped = (res.data?.photos || []).map((p) => ({
        ...p,
        url: normalizeUrl(p.url),
      }));
      setViewUserPhotos(mapped);
      setViewUserLiked(new Set(res.data?.liked || []));
    } catch (err) {
      setViewUserPhotos([]);
      setViewUserLiked(new Set());
      console.error("Load other user photos failed:", err);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  async function handleFeedback() {
    const msg = window.prompt("Share your feedback for Gestura:");
    const trimmed = (msg || "").trim();
    if (!trimmed) {
      setShowSettings(false);
      return;
    }
    try {
      await API.post("/api/feedback", { message: trimmed });
      alert("Thank you! Your feedback was sent.");
    } catch (err) {
      console.error("Feedback send failed:", err);
      alert("Could not send feedback. Please try again later.");
    } finally {
      setShowSettings(false);
    }
  }

  async function addFriend(userId) {
    try {
      if (!profile?.id) return;
      await API.post("/api/friends/add", { user_id: profile?.id, friend_id: userId });
      await refreshFriends(profile?.id);
      setPendingOutgoing((prev) => new Set(prev).add(userId));
    } catch (err) {
      console.error("Add friend failed:", err);
    }
  }

  async function acceptFriend(requesterId) {
    try {
      if (!profile?.id) return;
      await API.post("/api/friends/accept", { user_id: profile?.id, requester_id: requesterId });
      await refreshFriends(profile?.id);
    } catch (err) {
      console.error("Accept friend failed:", err);
    }
  }

  async function removeFriend(friendId) {
    try {
      if (!profile?.id) return;
      await API.post("/api/friends/remove", { user_id: profile?.id, friend_id: friendId });
      await refreshFriends(profile?.id);
    } catch (err) {
      console.error("Remove friend failed:", err);
    }
  }

  async function saveBio() {
    setBioMsg("");
    setSavingBio(true);
    try {
      const res = await API.put("/api/profile/bio", { bio: bioDraft });
      setProfile((prev) => ({ ...prev, bio: res.data.bio }));
      setBioMsg("Bio saved");
    } catch (err) {
      setBioMsg(err.response?.data?.error || "Failed to save bio");
    } finally {
      setSavingBio(false);
      setTimeout(() => setBioMsg(""), 1800);
    }
  }

  async function saveRecoveryEmail() {
    setRecoveryErr("");
    setRecoveryMsg("");
    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setRecoveryErr("Please enter a recovery email.");
      return;
    }
    const primaryEmail = profile?.email?.trim().toLowerCase();
    if (primaryEmail && cleanEmail === primaryEmail) {
      setRecoveryErr("Recovery email must be different from your main email.");
      return;
    }
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    if (!valid) {
      setRecoveryErr("Please enter a valid email address.");
      return;
    }
    try {
      setRecoverySaving(true);
      const res = await API.post("/auth/recovery-email/request", { recovery_email: cleanEmail });
      setRecoveryMsg(res.data?.message || "Recovery verification sent.");
      setRecoveryVerified(false);
    } catch (err) {
      setRecoveryErr(err.response?.data?.error || "Could not update recovery email.");
    } finally {
      setRecoverySaving(false);
    }
  }

  async function removeRecoveryEmail() {
    if (!window.confirm("Remove your recovery email?")) return;
    setRecoveryErr("");
    setRecoveryMsg("");
    try {
      setRecoverySaving(true);
      const res = await API.post("/auth/recovery-email/remove");
      setRecoveryEmail("");
      setRecoveryVerified(false);
      setRecoveryMsg(res.data?.message || "Recovery email removed.");
    } catch (err) {
      setRecoveryErr(err.response?.data?.error || "Could not remove recovery email.");
    } finally {
      setRecoverySaving(false);
    }
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function changeCoverFromFile(file) {
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await API.post("/api/profile/cover/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.url) {
        setCoverUrl(normalizeUrl(res.data.url));
      }
    } catch (err) {
      console.error("Cover file error:", err);
    }
  }

  async function changeAvatarFromFile(file) {
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await API.post("/api/profile/avatar/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.url) {
        setAvatarUrl(normalizeUrl(res.data.url));
      }
    } catch (err) {
      console.error("Avatar file error:", err);
    }
  }

  function triggerCoverFile() {
    coverInputRef.current?.click();
  }

  function triggerAvatarFile() {
    avatarInputRef.current?.click();
  }

  async function addFeedItem(e) {
    e.preventDefault();
    const url = photoUrl.trim();
    const text = caption.trim();
    const file = feedFileRef.current?.files?.[0];
    let finalUrl = url;
    if (file) {
      try {
        const form = new FormData();
        form.append("image", file);
        form.append("caption", text);
        const uploadRes = await API.post("/api/profile/photos/upload", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        finalUrl = normalizeUrl(uploadRes.data?.url || "");
      } catch (err) {
        console.error("Photo file error:", err);
      }
    }
    if (!finalUrl) return;
    if (!file) {
      await API.post("/api/profile/photos", { url: finalUrl, caption: text });
    }
    const photosRes = await API.get("/api/profile/photos");
    const mapped = (photosRes.data?.photos || []).map((p) => ({
      ...p,
      url: normalizeUrl(p.url),
    }));
    setFeedItems(mapped);
    setLikedIds(new Set(photosRes.data?.liked || []));
    setPhotoUrl("");
    setCaption("");
    if (feedFileRef.current) {
      feedFileRef.current.value = "";
    }
    setPendingFileName("");
  }

  function likeItem(id) {
    API.post(`/api/profile/photos/${id}/like`)
      .then((res) => {
        const { likes, liked } = res.data;
        setFeedItems((prev) => prev.map((item) => (item.id === id ? { ...item, likes } : item)));
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (liked) next.add(id);
          else next.delete(id);
          return next;
        });
        setSelectedPhoto((prev) => (prev && prev.id === id ? { ...prev, likes } : prev));
      })
      .catch((err) => console.error("Like toggle failed", err));
  }

  async function toggleViewLike(id) {
    try {
      const res = await API.post(`/api/profile/photos/${id}/like`);
      const liked = res.data?.liked ?? false;
      const likes = res.data?.likes;
      setViewUserLiked((prev) => {
        const next = new Set(prev);
        if (liked) next.add(id);
        else next.delete(id);
        return next;
      });
      if (typeof likes === "number") {
        setViewUserPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, likes } : p)));
        if (selectedPhoto?.id === id && selectedPhoto.source === "view") {
          setSelectedPhoto((prev) => (prev ? { ...prev, likes } : prev));
        }
      }
    } catch (err) {
      console.error("Toggle like for viewed user failed:", err);
    }
  }

  const formatDateTime = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  };

  if (loading) {
    return (
      <div className="app-shell text-gray-100 flex items-center justify-center">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="app-shell text-gray-100 flex items-center justify-center">
        Failed to load profile.
      </div>
    );
  }

  return (
    <div className="app-shell text-gray-100">
      <div className="app-header sticky top-0 z-10 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate("/home")}
          className="btn-ghost px-3 py-1.5 rounded-full text-xs"
        >
          Home
        </button>
        <div className="relative">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="btn-ghost w-10 h-10 flex items-center justify-center rounded-full text-lg font-bold"
            aria-label="Profile settings"
          >
            ...
          </button>
          {showSettings && (
            <div className="absolute right-0 mt-2 w-52 rounded-lg border border-white/10 bg-slate-950/90 backdrop-blur shadow-lg flex flex-col text-sm text-slate-100 overflow-hidden">
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowSecurityModal(true);
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-900 border-b border-white/10"
              >
                Security
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  navigate("/forgot-password");
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-900 border-b border-white/10"
              >
                Reset password
              </button>
              <button
                onClick={handleFeedback}
                className="w-full px-3 py-2 text-left hover:bg-slate-900 border-b border-white/10"
              >
                Send feedback
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  handleLogout();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-900"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        <div className="mt-4 rounded-xl overflow-hidden border border-slate-800 h-48 sm:h-56 md:h-64 relative group">
          <img
            src={coverUrl}
            alt="Cover"
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <label className="absolute bottom-3 right-3 z-10 cursor-pointer">
            <span className="text-xs px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 text-white hover:bg-slate-800 inline-block select-none">
              Edit cover photo
            </span>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  changeCoverFromFile(file);
                } else {
                  const url = window.prompt("Paste a cover image URL:");
                  if (url && url.trim()) setCoverUrl(url.trim());
                }
              }}
            />
          </label>
        </div>

        <div className="relative flex flex-col items-center -mt-14 sm:-mt-16">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-emerald-600 border-4 border-slate-950 flex items-center justify-center text-3xl font-bold shadow-lg shadow-emerald-900/40 overflow-hidden ring-2 ring-transparent hover:ring-emerald-500 transition">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <>
                {profile.firstname?.[0]}
                {profile.lastname?.[0]}
              </>
            )}
          </div>
          <button
            onClick={triggerAvatarFile}
            type="button"
            className="mt-2 px-3 py-1 rounded-full border border-slate-700 bg-slate-900 text-xs hover:bg-slate-800"
          >
            Change photo
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) changeAvatarFromFile(file);
            }}
          />
          <div className="mt-2 text-center space-y-1 px-4">
            <h1 className="text-2xl font-bold text-white">
              {profile.firstname} {profile.lastname}
            </h1>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <span>@{profile.username}</span>
              <span className="w-1 h-1 rounded-full bg-slate-600" />
              <span>{profile.email}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-300">
              <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 mt-6 items-start">
          <div className="space-y-4 lg:col-span-1">
            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">Intro</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-700/20 text-emerald-200 border border-emerald-700">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
                <span className="font-semibold">Bio</span>
                <button
                  onClick={() => setEditingBio((v) => !v)}
                  className="btn-ghost text-[11px] px-2 py-1 rounded-full"
                >
                  Edit
                </button>
              </div>
              {editingBio ? (
                <div className="space-y-2">
                  <textarea
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value)}
                    rows={3}
                    className="w-full bg-transparent border border-white/10 rounded-lg p-3 text-sm text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveBio}
                      disabled={savingBio}
                      className="btn-primary px-3 py-1.5 rounded-full text-[11px] font-semibold disabled:opacity-60"
                    >
                      {savingBio ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingBio(false)}
                      className="btn-secondary px-3 py-1.5 rounded-full text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                  {bioMsg && <p className="text-[11px] text-emerald-300">{bioMsg}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-300 mb-3">{profile.bio || "No bio yet."}</p>
              )}
              <a
                href={`mailto:${profile.email}`}
                className="inline-flex items-center gap-2 text-sm text-emerald-200 hover:text-emerald-100"
              >
                Email: {profile.email}
              </a>
            </div>

            {!isAdmin && (
              <>
              </>
            )}

            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">Friends</h3>
                <span className="text-xs text-slate-500">{friends.length}</span>
              </div>
              {friends.length === 0 ? (
                <p className="text-slate-500 text-sm">No friends added yet.</p>
              ) : (
                <div className="space-y-2">
                  {friends.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-2 bg-slate-800/60 border border-slate-700 rounded-lg gap-2"
                    >
                      <div className="flex items-center gap-2 flex-1 overflow-hidden">
                        <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                          {f.firstname?.[0]}
                          {f.lastname?.[0]}
                        </div>
                        <div className="text-xs overflow-hidden">
                          <p className="font-semibold text-white leading-none truncate">
                            {f.firstname} {f.lastname}
                          </p>
                          <p className="text-slate-400 text-[11px] truncate">{f.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            setViewUser(f);
                            loadViewUserPhotos(f.id);
                          }}
                          className="text-[11px] px-2 py-1 rounded-full bg-slate-900 border border-slate-700 hover:bg-slate-800"
                        >
                          View
                        </button>
                        <button
                          onClick={() => removeFriend(f.id)}
                          className="text-[11px] px-2 py-1 rounded-full bg-slate-900 border border-slate-700 hover:bg-slate-800"
                        >
                          Unfriend
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">Requests</h3>
                <span className="text-xs text-slate-500">{pendingRequests.length}</span>
              </div>
              {pendingRequests.length === 0 ? (
                <p className="text-slate-500 text-sm">No pending requests.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {pendingRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-2 bg-slate-800/60 border border-slate-700 rounded-lg"
                    >
                      <div className="text-xs">
                        <p className="font-semibold text-white leading-none">
                          {r.firstname} {r.lastname}
                        </p>
                        <p className="text-slate-400 text-[11px]">@{r.username}</p>
                      </div>
                      <button
                        onClick={() => acceptFriend(r.requester_id)}
                        className="text-[11px] px-2 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold"
                      >
                        Accept
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">Active users</h3>
                <span className="text-xs text-slate-500">{activeUsers.length}</span>
              </div>
              {activeError && (
                <p className="text-amber-300 text-[11px] mb-2">{activeError}</p>
              )}
              {activeUsers.length === 0 && !activeError ? (
                <p className="text-slate-500 text-sm">No active users found.</p>
              ) : activeUsers.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {activeUsers
                  .filter((u) => u.id !== profile?.id)
                  .map((u) => {
                    const isFriend = friends.some((f) => f.id === u.id);
                    const isPending = pendingOutgoing.has(u.id);
                      return (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-2 bg-slate-800/60 border border-slate-700 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                              {u.firstname?.[0]}
                              {u.lastname?.[0]}
                            </div>
                            <div className="text-xs">
                              <p className="font-semibold text-white leading-none">
                                {u.firstname} {u.lastname}
                              </p>
                              <p className="text-slate-400 text-[11px]">@{u.username}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setViewUser(u);
                                loadViewUserPhotos(u.id);
                              }}
                              className="text-[11px] px-2 py-1 rounded-full bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-100"
                            >
                              View
                            </button>
                            <button
                              onClick={() => addFriend(u.id)}
                              disabled={isFriend || isPending}
                              className="text-[11px] px-2 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold disabled:bg-slate-700 disabled:text-slate-400"
                            >
                              {isFriend ? "Added" : isPending ? "Pending" : "Add"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/30 backdrop-blur">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">Photos</h3>
                <span className="text-xs text-slate-500">{feedItems.length}</span>
              </div>
              <form
                onSubmit={addFeedItem}
                className="flex flex-col md:flex-row gap-3 items-end mb-5 surface-card-strong p-4 shadow-inner shadow-black/30"
              >
                <div className="flex-1 space-y-1">
                  <label className="text-[11px] text-slate-400 block">Attach photo</label>
                  <input
                    ref={feedFileRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPendingFileName(e.target.files?.[0]?.name || "")}
                    className="w-full text-[11px] text-slate-200 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:text-slate-950 bg-transparent border border-white/10 rounded-lg"
                  />
                  {pendingFileName && (
                    <p className="text-[11px] text-slate-500 mt-1 truncate">{pendingFileName}</p>
                  )}
                </div>
                <div className="flex-1 space-y-1 w-full">
                  <label className="text-[11px] text-slate-400 block">Caption</label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Caption"
                    className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold w-full md:w-auto"
                >
                  Add photo
                </button>
              </form>

              {feedItems.length === 0 ? (
                <p className="text-slate-500 text-sm">No photos yet. Add one with a URL.</p>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {feedItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedPhoto({ ...item, source: "self" })}
                      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/80 border border-slate-700 shadow-lg shadow-black/30 hover:-translate-y-1 hover:shadow-emerald-500/10 transition cursor-pointer"
                    >
                      <div className="aspect-[4/3] bg-slate-900 overflow-hidden">
                        <img
                          src={item.url}
                          alt={item.caption}
                          className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent opacity-80" />
                      </div>
                      <div className="absolute inset-0 p-3 flex flex-col justify-end text-sm text-slate-100">
                        <p className="font-semibold truncate drop-shadow">{item.caption || "Untitled"}</p>
                        <p className="text-[11px] text-slate-300 mt-1 drop-shadow">
                          {formatDateTime(item.createdAt || item.created_at)}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-[11px]">
                          <button
                            onClick={() => likeItem(item.id)}
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur text-white"
                          >
                            {likedIds.has(item.id) ? "Unlike" : "Like"}
                          </button>
                          <span className="text-slate-200">{item.likes} likes</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-slate-950">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.caption}
                className="w-full max-h-[60vh] object-contain"
              />
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-sm text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-lg font-semibold text-white">{selectedPhoto.caption || "Untitled"}</p>
              <p className="text-sm text-slate-300">
                {formatDateTime(selectedPhoto.createdAt || selectedPhoto.created_at)}
              </p>
              <div className="flex items-center gap-3 text-sm text-slate-200">
                <button
                  onClick={() =>
                    selectedPhoto.source === "view"
                      ? toggleViewLike(selectedPhoto.id)
                      : likeItem(selectedPhoto.id)
                  }
                  className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold"
                >
                  {selectedPhoto.source === "view"
                    ? viewUserLiked.has(selectedPhoto.id)
                      ? "Unlike"
                      : "Like"
                    : likedIds.has(selectedPhoto.id)
                    ? "Unlike"
                    : "Like"}
                </button>
                <span>{selectedPhoto.likes} likes</span>
              </div>
              <p className="text-sm text-slate-300">Click outside the card to close.</p>
            </div>
          </div>
        </div>
      )}

      {showSecurityModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setShowSecurityModal(false)}
        >
          <div
            className="bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white">Security</h3>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="text-[11px] px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100"
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-slate-400">Recovery email (secondary)</label>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      recoveryEmail
                        ? recoveryVerified
                          ? "bg-emerald-700/20 text-emerald-200 border-emerald-700"
                          : "bg-amber-700/20 text-amber-200 border-amber-700"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {recoveryEmail ? (recoveryVerified ? "Verified" : "Not verified") : "Optional"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  Add a secondary recovery email for password reset if you lose access to your main email.
                </p>
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="secondary@example.com"
                  className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {recoveryErr && (
                  <p className="text-[11px] text-red-300 mt-2">{recoveryErr}</p>
                )}
                {recoveryMsg && (
                  <p className="text-[11px] text-emerald-300 mt-2">{recoveryMsg}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={saveRecoveryEmail}
                    disabled={recoverySaving}
                    className="btn-primary px-3 py-1.5 rounded-full text-[11px] font-semibold disabled:opacity-60"
                  >
                    {recoveryEmail && !recoveryVerified ? "Send verification link" : "Save recovery email"}
                  </button>
                  {recoveryEmail && (
                    <button
                      onClick={removeRecoveryEmail}
                      disabled={recoverySaving}
                      className="btn-secondary px-3 py-1.5 rounded-full text-[11px] disabled:opacity-60"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {!recoveryVerified && recoveryEmail && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Check your recovery email for a verification link.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

  {viewUser && (
        <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={() => setViewUser(null)}
    >
      <div
        className="bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">User profile</h3>
          <button
            onClick={() => setViewUser(null)}
            className="text-[11px] px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100"
          >
            Close
          </button>
        </div>
        <div className="p-5 space-y-2 text-sm text-slate-200">
          <p className="text-2xl font-bold text-emerald-300">
            {viewUser.firstname} {viewUser.lastname}
          </p>
          <p className="text-slate-400">@{viewUser.username}</p>
          <p className="text-slate-300">{viewUser.email}</p>
          <p className="text-[11px] text-slate-500">Basic profile preview (public)</p>

          <div className="mt-4 border-t border-slate-800 pt-3">
            <h4 className="text-sm font-semibold text-white mb-2">Photos</h4>
              {viewUserPhotos.length === 0 ? (
                <p className="text-slate-500 text-[13px]">No photos yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {viewUserPhotos.map((p) => (
                    <div
                      key={p.id}
                      className="group relative bg-slate-950/70 border border-slate-800 rounded-lg overflow-hidden shadow cursor-pointer"
                      onClick={() => setSelectedPhoto({ ...p, source: "view" })}
                    >
                      <div className="aspect-video bg-black overflow-hidden">
                        <img
                          src={p.url}
                          alt={p.caption}
                          className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-sm font-semibold">
                          View post
                        </div>
                      </div>
                      <div className="p-3 space-y-1 text-[12px]">
                        <p className="text-slate-100 font-semibold truncate">{p.caption || "Untitled"}</p>
                        <div className="flex items-center gap-2 text-slate-300">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleViewLike(p.id);
                            }}
                            className="px-2 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-[11px]"
                          >
                            {viewUserLiked.has(p.id) ? "Unlike" : "Like"}
                          </button>
                          <span className="text-[11px] text-slate-400">{p.likes} likes</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  )}
    </div>
  );
}
