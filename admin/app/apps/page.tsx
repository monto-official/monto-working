"use client";
import { useState } from "react";

type View = "split" | "kid" | "parent";

function Frame({ label, url, onUrl, full }: { label: string; url: string; onUrl: (u: string) => void; full: boolean }) {
  const [input, setInput] = useState(url);
  const [k, setK] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const go = () => { onUrl(input); setLoaded(false); setK(n => n + 1); };

  return (
    <div className={`flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden ${full ? "w-full" : "flex-1 min-w-0"}`}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-800 bg-gray-900/80">
        <span className="px-2 py-0.5 rounded text-xs font-medium border bg-indigo-600/20 border-indigo-600/30 text-indigo-400 shrink-0">{label}</span>
        <div className="flex-1 flex items-center gap-1.5 bg-gray-800/70 border border-gray-700/50 rounded-lg px-2.5 py-1.5">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && go()}
            className="flex-1 bg-transparent text-gray-300 text-xs outline-none font-mono min-w-0" />
        </div>
        <button onClick={() => { setLoaded(false); setK(n => n + 1); }} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors" title="Reload">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors" title="Open in new tab">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      </div>
      <div className="relative flex-1" style={{ minHeight: "calc(100vh - 220px)" }}>
        {!loaded && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900 z-10"><div className="w-8 h-8 border-2 border-gray-700 border-t-indigo-500 rounded-full animate-spin" /><p className="text-gray-500 text-xs">Loading {url}</p></div>}
        <iframe key={k} src={url} title={label} className="w-full h-full border-0" style={{ minHeight: "calc(100vh - 220px)" }} onLoad={() => setLoaded(true)} allow="microphone; camera; autoplay" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-presentation" />
      </div>
    </div>
  );
}

export default function AppsPage() {
  const [view, setView] = useState<View>("split");
  const [urls, setUrls] = useState({ kid: "http://localhost:3000", parent: "http://localhost:3001" });

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50 shrink-0">
        <div><h1 className="text-lg font-bold text-white">Apps</h1><p className="text-gray-500 text-xs mt-0.5">Preview connected applications</p></div>
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
          {(["split","kid","parent"] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize ${view === v ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}>{v}</button>
          ))}
        </div>
      </div>
      <div className={`flex-1 flex gap-3 p-4 overflow-hidden ${view === "split" ? "flex-row" : "flex-col"}`}>
        {(view === "split" || view === "kid") && <Frame label="Kid Frontend" url={urls.kid} onUrl={u => setUrls(p => ({...p, kid: u}))} full={view !== "split"} />}
        {(view === "split" || view === "parent") && <Frame label="Parent App" url={urls.parent} onUrl={u => setUrls(p => ({...p, parent: u}))} full={view !== "split"} />}
      </div>
      <div className="px-6 py-2 border-t border-gray-800 bg-gray-900/30 shrink-0">
        <p className="text-gray-600 text-xs text-center">Some apps may block iframe embedding. Use &ldquo;Open in new tab&rdquo; if the frame is blank.</p>
      </div>
    </div>
  );
}
