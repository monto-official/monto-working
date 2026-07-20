"use client";
import { useEffect, useState, useRef } from "react";

interface ApiCall { id: string; timestamp: Date; method: string; endpoint: string; status: number | null; duration: number | null; error: string | null; }

let counter = 0;

export default function MonitorPage() {
  const [calls, setCalls] = useState<ApiCall[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [healthData, setHealthData] = useState<Record<string, unknown> | null>(null);
  const [paused, setPaused] = useState(false);
  const callsRef = useRef<ApiCall[]>([]);

  const poll = async () => {
    if (paused) return;
    for (const path of ["/health", "/voice/memory"]) {
      const id = `call-${++counter}`;
      const t = new Date(); const start = performance.now();
      try {
        const res = await fetch(`/api/backend${path}`, { cache: "no-store" });
        const dur = Math.round(performance.now() - start);
        if (path === "/health") { setBackendOnline(res.ok); setResponseTime(dur); if (res.ok) setHealthData(await res.json()); }
        callsRef.current = [{ id, timestamp: t, method: "GET", endpoint: path, status: res.status, duration: dur, error: null }, ...callsRef.current].slice(0, 50);
      } catch (e) {
        const dur = Math.round(performance.now() - start);
        if (path === "/health") { setBackendOnline(false); setResponseTime(null); }
        callsRef.current = [{ id, timestamp: t, method: "GET", endpoint: path, status: null, duration: dur, error: (e as Error).message }, ...callsRef.current].slice(0, 50);
      }
      setCalls([...callsRef.current]);
    }
  };

  useEffect(() => { poll(); const t = setInterval(poll, 3000); return () => clearInterval(t); }, [paused]);

  const errorRate = calls.length ? Math.round(calls.filter(c => c.error || (c.status && c.status >= 400)).length / calls.length * 100) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-white">Live Monitor</h1><p className="text-gray-400 text-sm mt-0.5">Real-time backend API monitoring</p></div>
        <div className="flex gap-2">
          <button onClick={() => setPaused(p => !p)} className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${paused ? "bg-yellow-900/30 border-yellow-800/50 text-yellow-400" : "bg-gray-800 border-gray-700 text-gray-300"}`}>
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button onClick={() => { callsRef.current = []; setCalls([]); }} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors">Clear</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full shrink-0 ${backendOnline ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
          <div><p className="text-gray-400 text-xs uppercase">Backend :8000</p><p className={`text-sm font-semibold mt-0.5 ${backendOnline ? "text-green-400" : "text-red-400"}`}>{backendOnline ? "Online" : "Offline"}</p></div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4"><p className="text-gray-400 text-xs uppercase">Avg Response</p><p className="text-white text-xl font-bold mt-1">{responseTime !== null ? `${responseTime}ms` : "—"}</p></div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4"><p className="text-gray-400 text-xs uppercase">Error Rate</p><p className={`text-xl font-bold mt-1 ${errorRate > 0 ? "text-red-400" : "text-green-400"}`}>{errorRate}%</p></div>
      </div>

      {healthData && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-white font-semibold mb-3 text-sm">Health Response</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(healthData).map(([k, v]) => (
              <div key={k} className="bg-gray-800/60 rounded-lg px-3 py-2">
                <p className="text-gray-500 text-xs uppercase">{k}</p>
                <p className="text-white text-sm font-medium mt-0.5 capitalize truncate">{String(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${!paused ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />API Call Log
          </h2>
          <span className="text-gray-500 text-xs">Last 10 of {calls.length}</span>
        </div>
        {calls.length === 0 ? <p className="text-gray-500 text-sm text-center py-12">Waiting for API calls...</p>
        : <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-800">
                {["Time","Method","Endpoint","Status","Duration"].map(h => <th key={h} className={`px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wide ${h === "Duration" ? "text-right" : "text-left"}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {calls.slice(0, 10).map(c => (
                  <tr key={c.id} className="border-b border-gray-800/40 last:border-0 hover:bg-gray-800/30">
                    <td className="px-5 py-3 text-gray-500 text-xs font-mono">{c.timestamp.toLocaleTimeString()}</td>
                    <td className="px-4 py-3"><span className="px-1.5 py-0.5 rounded text-xs font-mono font-medium border bg-green-600/20 text-green-400 border-green-600/30">GET</span></td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{c.endpoint}{c.error && <p className="text-red-400/70 text-xs">{c.error}</p>}</td>
                    <td className="px-4 py-3">
                      {c.error ? <span className="px-2 py-0.5 rounded text-xs font-mono border bg-red-600/20 text-red-400 border-red-600/30">ERR</span>
                      : c.status ? <span className={`px-2 py-0.5 rounded text-xs font-mono border ${c.status < 400 ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-red-600/20 text-red-400 border-red-600/30"}`}>{c.status}</span>
                      : <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.duration !== null ? <span className={`text-xs font-mono ${c.duration > 1000 ? "text-red-400" : c.duration > 500 ? "text-yellow-400" : "text-green-400"}`}>{c.duration}ms</span> : <span className="text-gray-600 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>
    </div>
  );
}
