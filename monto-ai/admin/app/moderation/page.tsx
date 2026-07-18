"use client";

import { useEffect, useState, useCallback } from "react";

const API = "http://localhost:8000";

interface Category {
  id: string;
  label: string;
  color: string;
  desc: string;
}

interface WordsData {
  [category: string]: string[];
}

interface TestResult {
  text: string;
  is_safe: boolean;
  category: string | null;
  redirect_response: string | null;
  emotion: string;
}

const COLOR_MAP: Record<string, { badge: string; dot: string; bg: string }> = {
  red:    { badge: "bg-red-600/20 text-red-400 border border-red-600/30",       dot: "bg-red-400",    bg: "bg-red-900/10" },
  orange: { badge: "bg-orange-600/20 text-orange-400 border border-orange-600/30", dot: "bg-orange-400", bg: "bg-orange-900/10" },
  purple: { badge: "bg-purple-600/20 text-purple-400 border border-purple-600/30", dot: "bg-purple-400", bg: "bg-purple-900/10" },
  yellow: { badge: "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30", dot: "bg-yellow-400", bg: "bg-yellow-900/10" },
  blue:   { badge: "bg-blue-600/20 text-blue-400 border border-blue-600/30",     dot: "bg-blue-400",   bg: "bg-blue-900/10" },
};

const BUILTIN_COUNTS: Record<string, number> = {
  profanity: 18, violence: 14, adult: 13, danger: 7, custom: 0,
};

export default function ModerationPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [words, setWords]           = useState<WordsData>({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [newWord, setNewWord]       = useState("");
  const [newCat, setNewCat]         = useState("custom");
  const [adding, setAdding]         = useState(false);
  const [addError, setAddError]     = useState<string | null>(null);
  const [testText, setTestText]     = useState("");
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [removing, setRemoving]     = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState("custom");

  const fetchData = useCallback(async () => {
    try {
      const [catRes, wordsRes] = await Promise.all([
        fetch(`${API}/moderation/categories`).then(r => r.json()),
        fetch(`${API}/moderation/words`).then(r => r.json()),
      ]);
      setCategories(catRes.categories);
      setWords(wordsRes.words);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    const w = newWord.trim().toLowerCase();
    if (!w) return;
    setAdding(true); setAddError(null);
    try {
      const res = await fetch(`${API}/moderation/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: w, category: newCat }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to add word");
      setNewWord("");
      setActiveTab(newCat);
      await fetchData();
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (category: string, word: string) => {
    const key = `${category}:${word}`;
    setRemoving(key);
    try {
      const res = await fetch(
        `${API}/moderation/words/${encodeURIComponent(category)}/${encodeURIComponent(word)}`,
        { method: "DELETE" }
      );
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Failed"); }
      await fetchData();
    } catch (err) { alert((err as Error).message); }
    finally { setRemoving(null); }
  };

  const handleTest = async () => {
    if (!testText.trim()) return;
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch(`${API}/moderation/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testText }),
      });
      setTestResult(await res.json());
    } catch (err) { alert((err as Error).message); }
    finally { setTesting(false); }
  };

  const totalCustom  = Object.values(words ?? {}).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0);
  const activeWords  = Array.isArray(words?.[activeTab]) ? words[activeTab] : [];
  const activeCat    = categories.find(c => c.id === activeTab);
  const activeColor  = activeCat ? (COLOR_MAP[activeCat.color] ?? COLOR_MAP.blue) : COLOR_MAP.blue;

  if (loading) return (
    <div className="p-6 max-w-4xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-gray-800 rounded w-1/3" />
      <div className="h-4 bg-gray-800 rounded w-1/2" />
      <div className="h-64 bg-gray-900 rounded-xl" />
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">🛡️ Content Filter</h1>
        <p className="text-gray-400 text-sm mt-1">Block rough and bad words from reaching kids. Changes take effect instantly.</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-red-400 text-sm">
          Cannot reach backend: {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {categories.map(cat => {
          const c = COLOR_MAP[cat.color];
          const customCount  = (words[cat.id] ?? []).length;
          const builtinCount = BUILTIN_COUNTS[cat.id] ?? 0;
          return (
            <button key={cat.id} onClick={() => setActiveTab(cat.id)}
              className={`rounded-xl p-3 text-left border transition-all ${activeTab === cat.id ? `${c.bg} border-current` : "bg-gray-900 border-gray-800 hover:border-gray-700"}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className="text-white text-xs font-semibold truncate">{cat.label}</span>
              </div>
              <p className="text-white text-lg font-bold">{builtinCount + customCount}</p>
              <p className="text-gray-500 text-xs">{builtinCount} built-in{customCount > 0 ? ` + ${customCount}` : ""}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Word list */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-gray-800">
              {categories.map(cat => {
                const c = COLOR_MAP[cat.color];
                return (
                  <button key={cat.id} onClick={() => setActiveTab(cat.id)}
                    className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === cat.id ? `text-white border-white` : "text-gray-500 border-transparent hover:text-gray-300"}`}>
                    {cat.label}
                    {(words[cat.id] ?? []).length > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${c.badge}`}>{(words[cat.id] ?? []).length}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-4">
              {activeCat && <p className="text-gray-500 text-xs mb-3">{activeCat.desc}</p>}

              {activeWords.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-4xl mb-2">➕</p>
                  <p className="text-gray-400 text-sm font-medium">No custom words yet</p>
                  <p className="text-gray-600 text-xs mt-1">Add words using the form →</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeWords.map(word => (
                    <span key={word} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${activeColor.badge}`}>
                      {word}
                      <button onClick={() => handleRemove(activeTab, word)}
                        disabled={removing === `${activeTab}:${word}`}
                        className="opacity-50 hover:opacity-100 transition-opacity">
                        {removing === `${activeTab}:${word}`
                          ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>}
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {activeTab !== "custom" && BUILTIN_COUNTS[activeTab] > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <p className="text-gray-600 text-xs">{BUILTIN_COUNTS[activeTab]} built-in {activeCat?.label.toLowerCase()} words are also active (not shown here)</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add + Test */}
        <div className="space-y-4">
          {/* Add word */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Block a Word
            </h3>
            <div className="space-y-2.5">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Word or phrase</label>
                <input type="text" value={newWord} onChange={e => { setNewWord(e.target.value); setAddError(null); }}
                  onKeyDown={e => e.key === "Enter" && handleAdd()}
                  placeholder="e.g. badword"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Category</label>
                <select value={newCat} onChange={e => setNewCat(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                  {categories.map(cat => <option key={cat.id} value={cat.id} className="bg-gray-800">{cat.label}</option>)}
                </select>
              </div>
              {addError && <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">{addError}</p>}
              <button onClick={handleAdd} disabled={adding || !newWord.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-colors">
                {adding ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>Adding...</> : <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                  Block Word
                </>}
              </button>
            </div>
          </div>

          {/* Test phrase */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              Test a Phrase
            </h3>
            <p className="text-gray-500 text-xs mb-3">Check if a phrase gets blocked</p>
            <textarea value={testText} onChange={e => { setTestText(e.target.value); setTestResult(null); }}
              placeholder="Type a phrase to test..." rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none" />
            <button onClick={handleTest} disabled={testing || !testText.trim()}
              className="w-full mt-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-colors">
              {testing ? "Testing..." : "Test Filter"}
            </button>
            {testResult && (
              <div className={`mt-3 rounded-lg p-3 border text-sm ${testResult.is_safe ? "bg-green-900/20 border-green-800/50" : "bg-red-900/20 border-red-800/50"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{testResult.is_safe ? "✅" : "🚫"}</span>
                  <span className={`font-semibold ${testResult.is_safe ? "text-green-400" : "text-red-400"}`}>
                    {testResult.is_safe ? "Safe — allowed" : `Blocked (${testResult.category})`}
                  </span>
                </div>
                {!testResult.is_safe && testResult.redirect_response && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <p className="text-gray-500 text-xs mb-1">Monto would say:</p>
                    <p className="text-gray-300 text-xs italic">"{testResult.redirect_response}"</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-white font-semibold text-sm mb-2">Filter Summary</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-gray-500">Built-in words</span><span className="text-white font-medium">{Object.values(BUILTIN_COUNTS).reduce((a, b) => a + b, 0)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Custom words</span><span className="text-indigo-400 font-medium">{totalCustom}</span></div>
              <div className="flex justify-between text-xs pt-1 border-t border-gray-800"><span className="text-gray-400 font-medium">Total blocked</span><span className="text-white font-bold">{Object.values(BUILTIN_COUNTS).reduce((a, b) => a + b, 0) + totalCustom}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
