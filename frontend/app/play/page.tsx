"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PlayExternalPage() {
  const router = useRouter();
  const [src, setSrc] = useState<string | null>(null);
  const [title, setTitle] = useState("Game");
  const [backRoute, setBackRoute] = useState("/games");

  // Read ?src=&title= the same way stories/page.tsx reads ?track= — avoids
  // needing a Suspense boundary for useSearchParams in the app router.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSrc(params.get("src"));
    setTitle(params.get("title") || "Game");
    setBackRoute(params.get("back") || "/games");
  }, []);

  return (
    <main className="relative flex min-h-[100dvh] flex-col bg-black text-white">
      <header className="flex items-center justify-between gap-2 bg-black/85 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(backRoute)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <button onClick={() => router.push("/")} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <p className="truncate text-sm font-bold">{title}</p>
        {src
          ? <a href={src} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Open in new tab"><ExternalLink className="h-5 w-5" /></a>
          : <div className="h-10 w-10" />}
      </header>

      {src ? (
        <iframe
          key={src}
          src={src}
          title={title}
          className="w-full flex-1 border-0 bg-white"
          allow="autoplay; fullscreen; microphone; camera"
          allowFullScreen
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-white/50">No game link provided.</div>
      )}
    </main>
  );
}
