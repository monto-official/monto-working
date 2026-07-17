"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bell, Phone, Music, Mic } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/call", label: "Call", icon: Phone },
  { href: "/music", label: "Music", icon: Music },
  { href: "/recordings", label: "Recordings", icon: Mic },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 left-0 right-0 bg-card border-t px-2 pt-2 pb-3 shadow-card z-30">
      <ul className="flex justify-between items-center">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
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
