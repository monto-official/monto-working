import type { ReactNode } from "react";

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-stretch justify-center md:py-8 md:px-4" style={{ background: "oklch(0.94 0.02 260)" }}>
      <div className="w-full max-w-[440px] bg-background md:rounded-[2.5rem] md:shadow-elevated md:border md:overflow-hidden flex flex-col min-h-screen md:min-h-[900px] md:max-h-[900px] relative">
        {children}
      </div>
    </div>
  );
}
