import Link from "next/link";
import { SessionSummary } from "@/lib/api";

function timeAgo(ts: number | null): string {
  if (!ts) return "";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTs(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SessionRow({ session }: { session: SessionSummary }) {
  const name = session.facts?.name;
  return (
    <Link href={`/sessions/${encodeURIComponent(session.session_id)}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-800/60 transition-colors border-b border-gray-800/50 last:border-0 group">
      <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center shrink-0">
        <span className="text-indigo-400 text-sm font-semibold">{name ? name[0].toUpperCase() : "?"}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium truncate">{name ?? <span className="text-gray-500 italic">Unknown child</span>}</p>
          {session.facts?.age && <span className="text-xs text-gray-500 shrink-0">age {session.facts.age}</span>}
        </div>
        <p className="text-gray-500 text-xs truncate mt-0.5">{session.session_id}</p>
        {session.facts?.interests?.length && <p className="text-gray-600 text-xs truncate mt-0.5">Likes: {session.facts.interests.join(", ")}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-white text-sm font-semibold">{session.total_messages}</p>
        <p className="text-gray-500 text-xs mt-0.5">{timeAgo(session.last_message)}</p>
        <p className="text-gray-600 text-xs">{formatTs(session.last_message)}</p>
      </div>
      <svg className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
