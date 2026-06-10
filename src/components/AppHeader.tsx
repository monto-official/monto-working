import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function MontoLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "size-10" : size === "sm" ? "size-7" : "size-8";
  const text = size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base";
  return (
    <div className="flex items-center gap-2">
      <div className={`${dim} rounded-xl brand-gradient flex items-center justify-center text-white font-bold shadow-card`}>
        M
      </div>
      <span className={`font-display font-bold ${text} tracking-tight`}>
        Monto<span className="text-primary"> Parent</span>
      </span>
    </div>
  );
}

export function PageHeader({ title, back = "/dashboard", right }: { title: string; back?: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
      <Link to={back} className="size-9 rounded-full bg-muted flex items-center justify-center">
        <ChevronLeft className="size-5" />
      </Link>
      <h1 className="font-display font-bold text-base">{title}</h1>
      <div className="size-9 flex items-center justify-center">{right}</div>
    </header>
  );
}
