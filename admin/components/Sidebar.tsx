"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navLinks = [
  { href: "/",           label: "Dashboard",      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/sessions",   label: "Sessions",       icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
  { href: "/monitor",    label: "Live Monitor",   icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { href: "/apps",       label: "Apps",           icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
  { href: "/controls",   label: "App Controls",    icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100 4m0-4v-8m0 8a2 2 0 110 4m12-6a2 2 0 100 4m0-4V4m0 10a2 2 0 110 4" },
  { href: "/moderation", label: "Content Filter", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { href: "/settings",   label: "Settings",       icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [status, setStatus] = useState({ backend: false, kidFrontend: false, parentApp: false });

  useEffect(() => {
    const check = async () => {
      const [b, k, p] = await Promise.all([
        fetch("/api/backend/health", { cache: "no-store" }).then(r => r.ok).catch(() => false),
        fetch("http://localhost:3000", { cache: "no-store", mode: "no-cors" }).then(() => true).catch(() => false),
        fetch("http://localhost:3001", { cache: "no-store", mode: "no-cors" }).then(() => true).catch(() => false),
      ]);
      setStatus({ backend: b, kidFrontend: k, parentApp: p });
    };
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Monto Admin</p>
            <p className="text-gray-500 text-xs">Control Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navLinks.map(link => {
          const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
              </svg>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-800 space-y-2">
        <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Services</p>
        {[
          { label: "Backend :8000", ok: status.backend },
          { label: "Kid App :3000",  ok: status.kidFrontend },
          { label: "Parent App :3001", ok: status.parentApp },
        ].map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <span className="text-gray-400 text-xs">{s.label}</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${s.ok ? "bg-green-400" : "bg-red-500"}`} />
              <span className={`text-xs ${s.ok ? "text-green-400" : "text-red-400"}`}>{s.ok ? "Online" : "Offline"}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
