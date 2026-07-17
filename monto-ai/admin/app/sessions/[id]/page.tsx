"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession, clearSession, SessionDetail } from "@/lib/api";

function formatTs(ts: number | null) { return ts ? new Date(ts * 1000).toLocaleString() : "—"; }
function timeAgo(ts: number | null) {
  if (!ts) return "—";
  const d = Date.now() / 1000 - ts;
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export default function SessionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const sid = decodeURIComponent(id as string);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const fetch_ = useCallback(async () => {
    try { setSession(await getSession(sid)); } finally { setLoading(false); }
  }, [sid]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleClear = async () => {
    if (!confirm(`Clear all memory for "${sid}"?`)) return;
    setClearing(true);
    await clearSession(sid);
    setCleared(true);
    setTimeout(() => router.push("/sessions"), 1500);
    setClearing(false);
  };

  if (loading) return <div className="p-6 max-w-3xl mx-auto animate-pulse space-y-4"><div className="h-8 bg-gray-800 rounded w-1/3" /><div className="h-40 bg-gray-900 rounded-xl mt-6" /></div>;
  if (!session) return <div className="p-6"><button onClick={() => router.push("/sessions")} className="text-gray-400 text-sm mb-4 flex items-center gap-1">← Back</button><p className="text-red-400">Session not found</p></div>;

  const name = session.facts?.name;
  const history = session.history ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => router.push("/sessions")} className="text-gray-400 hover:text-white text-sm mb-5 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Sessions
      </button>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center text-2xl">{name ? name[0].toUpperCase() : "?"}</div>
          <div>
            <h1 className="text-xl font-bold text-white">{name ?? <span className="text-gray-400 italic">Unknown Child</span>}</h1>
            <p className="text-gray-500 text-xs font-mono mt-0.5">{sid}</p>
            <p className="text-gray-500 text-xs mt-1">Last active: {timeAgo(session.last_message)}</p>
          </div>
        </div>
        <button onClick={handleClear} disabled={clearing || cleared}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${cleared ? "bg-green-900/20 border-green-800/50 text-green-400" : "bg-red-900/20 hover:bg-red-900/40 border-red-800/50 text-red-400"}`}>
          {cleared ? "✓ Cleared" : clearing ? "Clearing..." : "🗑 Clear Memory"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[["Messages", session.total_messages], ["First seen", formatTs(session.first_message)], ["Last active", formatTs(session.last_message)]].map(([l, v]) => (
          <div key={l as string} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide">{l}</p>
            <p className="text-white text-sm font-bold mt-1">{v}</p>
          </div>
        ))}
      </div>

      {Object.keys(session.facts ?? {}).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-white font-semibold mb-3 text-sm">🧠 Known Facts</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {session.facts?.name && <div className="bg-gray-800/60 rounded-lg px-3 py-2"><p className="text-gray-500 text-xs uppercase">Name</p><p className="text-white text-sm font-medium mt-0.5">{session.facts.name}</p></div>}
            {session.facts?.age && <div className="bg-gray-800/60 rounded-lg px-3 py-2"><p className="text-gray-500 text-xs uppercase">Age</p><p className="text-white text-sm font-medium mt-0.5">{session.facts.age} years</p></div>}
            {session.facts?.grade && <div className="bg-gray-800/60 rounded-lg px-3 py-2"><p className="text-gray-500 text-xs uppercase">Grade</p><p className="text-white text-sm font-medium mt-0.5">Class {session.facts.grade}</p></div>}
            {session.facts?.interests?.length && <div className="bg-gray-800/60 rounded-lg px-3 py-2 col-span-2"><p className="text-gray-500 text-xs uppercase">Interests</p><div className="flex flex-wrap gap-1 mt-1">{session.facts.interests.map(i => <span key={i} className="px-2 py-0.5 rounded-full bg-indigo-600/20 border border-indigo-600/30 text-indigo-400 text-xs">{i}</span>)}</div></div>}
            {session.facts?.last_topic && <div className="bg-gray-800/60 rounded-lg px-3 py-2 col-span-3"><p className="text-gray-500 text-xs uppercase">Last Topic</p><p className="text-white text-sm mt-0.5 truncate">{session.facts.last_topic}</p></div>}
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm">💬 Conversation History <span className="text-gray-500 font-normal">({history.length} messages)</span></h2>
        </div>
        {history.length === 0 ? <p className="text-gray-500 text-sm text-center py-10">No history available</p>
        : <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
            {history.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div key={i} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                  {!isUser && <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center shrink-0 mt-0.5"><span className="text-indigo-400 text-xs font-bold">M</span></div>}
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isUser ? "bg-purple-600/20 border border-purple-600/30 text-purple-100 rounded-br-sm" : "bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm"}`}>{msg.content}</div>
                  {isUser && <div className="w-7 h-7 rounded-full bg-purple-600/20 border border-purple-600/30 flex items-center justify-center shrink-0 mt-0.5"><span className="text-purple-400 text-xs font-bold">{name ? name[0].toUpperCase() : "U"}</span></div>}
                </div>
              );
            })}
          </div>}
      </div>
    </div>
  );
}
