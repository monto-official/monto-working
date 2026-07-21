"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { MontoLogo } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth-client";
import { saveAuthSession } from "@/lib/auth-storage";
import { saveParentAccount } from "@/lib/profile-storage";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await login(email.trim(), password);
      saveAuthSession(session);
      saveParentAccount({ name: session.name, email: session.email });
      toast.success(`Welcome back, ${session.name || "there"}! 👋`);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log in — try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PhoneShell>
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-10">
        <MontoLogo size="lg" />
        <h1 className="mt-6 text-xl font-bold text-center">Log in</h1>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
          Welcome back to Monto Parent.
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              className="h-11 rounded-xl"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full h-11 rounded-2xl">
            {loading ? "Logging in..." : "Log In"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary font-semibold">Sign up</Link>
        </p>
      </div>
    </PhoneShell>
  );
}
