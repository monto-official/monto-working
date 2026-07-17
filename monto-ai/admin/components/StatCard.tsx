import { ReactNode } from "react";

const accentMap: Record<string, string> = {
  indigo: "text-indigo-400 bg-indigo-600/10 border-indigo-600/20",
  purple: "text-purple-400 bg-purple-600/10 border-purple-600/20",
  green:  "text-green-400 bg-green-600/10 border-green-600/20",
  yellow: "text-yellow-400 bg-yellow-600/10 border-yellow-600/20",
  red:    "text-red-400 bg-red-600/10 border-red-600/20",
  blue:   "text-blue-400 bg-blue-600/10 border-blue-600/20",
};

export default function StatCard({ title, value, subtitle, icon, accent = "indigo", loading = false }:
  { title: string; value: string | number; subtitle?: string; icon?: ReactNode; accent?: string; loading?: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start gap-4">
      {icon && <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${accentMap[accent]}`}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</p>
        {loading ? <div className="h-7 w-24 bg-gray-800 rounded animate-pulse mt-1" /> : <p className="text-white text-2xl font-bold mt-0.5 truncate">{value}</p>}
        {subtitle && !loading && <p className="text-gray-500 text-xs mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}
