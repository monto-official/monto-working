"use client";
import { useEffect, useState, useCallback } from "react";
import SessionRow from "@/components/SessionRow";
import { getSessions, getSession, SessionSummary } from "@/lib/api";

export default function SessionsPage() {
  const [ids, setIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchSessions = useCallback(async () => {
    try {
      const res = await getSessions();
      setIds(res.sessions);
      const summaries = await Promise.all(res.sessions.slice(0, 50).map(id =>
        getSession(id).catch(() => ({ session_id: id, total_messages: 0, first_message: null, last_message: null, facts: {} }))
      ));
      summaries.sort((a, b) => (b.last_message ?? 0) - (a.last_message ?? 0));
      setSessions(summaries);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const filtered = sessions.filter(s => !search || s.session_id.toLowerCase().includes(search.toLowerCase()) || s.facts?.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="text-gray-400 text-sm mt-0.5">{loading ? "Loading..." : `${ids.length} total sessions`}</p>
        </div>
        <button onClick={fetchSessions} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input type="text" placeholder="Search sessions..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? <div className="divide-y divide-gray-800/50">{[1,2,3,4,5].map(i => <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse"><div className="w-10 h-10 rounded-full bg-gray-800 shrink-0" /><div className="flex-1 space-y-1.5"><div className="h-3.5 bg-gray-800 rounded w-1/3" /><div className="h-3 bg-gray-800 rounded w-1/2" /></div></div>)}</div>
        : filtered.length === 0 ? <div className="text-center py-16"><p className="text-gray-400 text-sm">{search ? `No sessions match "${search}"` : "No sessions yet"}</p></div>
        : filtered.map(s => <SessionRow key={s.session_id} session={s} />)}
      </div>
    </div>
  );
}
