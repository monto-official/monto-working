"use client";
import { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";
import { getHealth, getSessions, HealthResponse, SessionsResponse } from "@/lib/api";

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sessions, setSessions] = useState<SessionsResponse | null>(null);
  const [hLoading, setHL] = useState(true);
  const [sLoading, setSL] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    const [h, s] = await Promise.allSettled([getHealth(), getSessions()]);
    setHealth(h.status === "fulfilled" ? h.value : null);
    setSessions(s.status === "fulfilled" ? s.value : null);
    setHL(false); setSL(false);
    setLastUpdated(new Date());
  };

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 5000); return () => clearInterval(t); }, []);

  const healthOk = health?.status === "ok";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Monto AI system overview</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="text-gray-500 text-xs">Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Backend" value={health ? (healthOk ? "Online" : "Degraded") : "Offline"} subtitle={health?.status ?? "Not reachable"} accent={health ? (healthOk ? "green" : "yellow") : "red"} loading={hLoading}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard title="Sessions" value={sessions?.total ?? 0} subtitle="All time sessions" accent="indigo" loading={sLoading}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        <StatCard title="AI Mode" value={health?.mode ?? "—"} subtitle={health?.llm ?? "Unknown LLM"} accent="purple" loading={hLoading}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
        <StatCard title="STT Engine" value={health?.stt ?? "—"} subtitle={`TTS: ${health?.tts ?? "—"}`} accent="blue" loading={hLoading}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Backend Status</h2>
          {health && <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${healthOk ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-red-600/20 text-red-400 border-red-600/30"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${healthOk ? "bg-green-400" : "bg-red-400"}`} />{health.status}
          </span>}
        </div>
        {hLoading ? <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />)}</div>
        : health ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(health).map(([k, v]) => (
              <div key={k} className="bg-gray-800/60 rounded-lg px-3 py-2">
                <p className="text-gray-500 text-xs uppercase tracking-wide">{k}</p>
                <p className="text-white text-sm font-medium mt-0.5 capitalize truncate">{String(v)}</p>
              </div>
            ))}
          </div>
        : <p className="text-red-400 text-sm text-center py-6">Cannot reach backend at localhost:8000</p>}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Recent Sessions</h2>
          <a href="/sessions" className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">View all →</a>
        </div>
        {sLoading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-800 rounded-lg animate-pulse" />)}</div>
        : sessions?.sessions.length ? <div className="space-y-1.5">
            {sessions.sessions.slice(0, 5).map(id => (
              <a key={id} href={`/sessions/${encodeURIComponent(id)}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors group">
                <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-gray-300 text-sm font-mono truncate">{id}</span>
                <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-indigo-400 ml-auto shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </a>
            ))}
            {sessions.sessions.length > 5 && <p className="text-gray-500 text-xs px-3 pt-1">+ {sessions.sessions.length - 5} more</p>}
          </div>
        : <p className="text-gray-500 text-sm text-center py-4">No sessions yet. Start a conversation with Monto!</p>}
      </div>
    </div>
  );
}
