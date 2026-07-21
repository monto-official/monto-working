"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loadAuthSession } from "@/lib/auth-storage";

const PUBLIC_ROUTES = ["/signup", "/login"];

/**
 * Gates every route behind a signed-in parent account. Runs client-side only
 * (this app is a static Capacitor export — no middleware) and checks
 * localStorage for a session saved by /signup or /login.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "authed" | "guest">("checking");

  useEffect(() => {
    const session = loadAuthSession();
    const isPublic = PUBLIC_ROUTES.includes(pathname);

    if (!session && !isPublic) {
      router.replace("/signup");
      setStatus("guest");
      return;
    }
    if (session && isPublic) {
      router.replace("/");
      setStatus("authed");
      return;
    }
    setStatus(session ? "authed" : "guest");
  }, [pathname, router]);

  // Avoid flashing protected content (or the signup form) for a frame while
  // the redirect above is still in flight.
  if (status === "checking") return null;
  if (status === "guest" && !PUBLIC_ROUTES.includes(pathname)) return null;
  if (status === "authed" && PUBLIC_ROUTES.includes(pathname)) return null;

  return <>{children}</>;
}
