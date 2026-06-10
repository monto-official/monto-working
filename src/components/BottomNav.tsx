import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Bell, Phone, Music, Mic } from "lucide-react";

const items = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/call", label: "Call", icon: Phone },
  { to: "/music", label: "Music", icon: Music },
  { to: "/recordings", label: "Recordings", icon: Mic },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky bottom-0 left-0 right-0 bg-card border-t px-2 pt-2 pb-3 shadow-card z-30">
      <ul className="flex justify-between items-center">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className={`p-1.5 rounded-xl ${active ? "bg-primary/10" : ""}`}>
                  <Icon className="size-5" />
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
