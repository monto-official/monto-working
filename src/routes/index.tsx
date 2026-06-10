import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { QrCode, ScanLine, Headset, Wifi, Shield, Sparkles } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { MontoLogo } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pair Your Device — Monto Parent" },
      { name: "description", content: "Connect your child's Monto AI Box to get started." },
    ],
  }),
  component: PairingScreen,
});

function PairingScreen() {
  const [mode, setMode] = useState<"qr" | "manual">("qr");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleConnect = () => {
    if (mode === "manual" && (!username || !password)) {
      toast.error("Please enter username and password");
      return;
    }
    toast.success("AI Box paired successfully");
    setTimeout(() => navigate({ to: "/login" }), 600);
  };

  return (
    <PhoneShell>
      <div className="flex items-center justify-between px-5 pt-5">
        <MontoLogo />
        <button className="text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-foreground/80 flex items-center gap-1">
          <Headset className="size-3.5" /> Contact
        </button>
      </div>

      <div className="px-5 pt-6 flex-1 overflow-y-auto pb-6">
        <div className="relative rounded-3xl p-6 soft-gradient overflow-hidden">
          <div className="absolute -top-8 -right-8 size-32 rounded-full bg-primary/15 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 size-32 rounded-full bg-secondary/20 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 text-[10px] font-semibold text-primary">
              <Sparkles className="size-3" /> AI LEARNING COMPANION
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-tight">Pair Your Device</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Connect your child's Monto AI Box to get started.
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2 bg-muted p-1 rounded-2xl">
          <button
            onClick={() => setMode("qr")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${mode === "qr" ? "bg-card shadow-card text-foreground" : "text-muted-foreground"}`}
          >Scan QR</button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${mode === "manual" ? "bg-card shadow-card text-foreground" : "text-muted-foreground"}`}
          >Manual</button>
        </div>

        {mode === "qr" ? (
          <div className="mt-5 rounded-3xl bg-card border p-5 shadow-card">
            <div className="aspect-square rounded-2xl border-2 border-dashed border-primary/30 brand-gradient/10 flex items-center justify-center relative overflow-hidden" style={{ background: "linear-gradient(135deg, oklch(0.97 0.03 263), oklch(0.96 0.04 295))" }}>
              <QrCode className="size-24 text-primary/40" strokeWidth={1.2} />
              <div className="absolute inset-x-6 h-0.5 bg-primary/70 shadow-[0_0_12px_oklch(0.55_0.21_263)] animate-pulse top-1/2" />
              <div className="absolute top-3 left-3 size-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
              <div className="absolute top-3 right-3 size-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
              <div className="absolute bottom-3 left-3 size-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
              <div className="absolute bottom-3 right-3 size-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
            </div>
            <p className="mt-4 text-center text-sm font-medium flex items-center justify-center gap-2">
              <ScanLine className="size-4 text-primary" />
              Scan AI Box QR Code
            </p>
            <p className="text-center text-xs text-muted-foreground mt-1">Find the QR on the back of your Monto box</p>
          </div>
        ) : (
          <div className="mt-5 rounded-3xl bg-card border p-5 shadow-card space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u">Username</Label>
              <Input id="u" placeholder="parent@monto.ai" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Password</Label>
              <Input id="p" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            { icon: Shield, label: "Secure" },
            { icon: Wifi, label: "Wireless" },
            { icon: Sparkles, label: "AI-Powered" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-2xl bg-card border p-3">
              <Icon className="size-4 text-primary mx-auto" />
              <p className="text-[11px] font-medium mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 border-t bg-card">
        <Button onClick={handleConnect} className="w-full h-12 rounded-2xl text-base brand-gradient text-white shadow-elevated hover:opacity-95">
          Connect
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Already paired? <Link to="/login" className="text-primary font-medium">Sign in</Link>
        </p>
      </div>
    </PhoneShell>
  );
}
