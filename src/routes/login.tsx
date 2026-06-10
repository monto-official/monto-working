import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, User, Lock, Baby, Hash, GraduationCap } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { MontoLogo } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Welcome Back — Monto Parent" }] }),
  component: LoginScreen,
});

function LoginScreen() {
  const [showPw, setShowPw] = useState(false);
  const navigate = useNavigate();

  return (
    <PhoneShell>
      <div className="flex flex-col items-center pt-8 pb-4">
        <MontoLogo size="lg" />
      </div>
      <div className="px-6 pb-2 text-center">
        <h1 className="text-2xl font-bold">Welcome Back</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your child's AI learning experience.</p>
      </div>

      <form
        className="px-5 py-5 flex-1 overflow-y-auto space-y-5"
        onSubmit={(e) => { e.preventDefault(); toast.success("Logged in"); navigate({ to: "/dashboard" }); }}
      >
        <Section title="Parent Information">
          <Field icon={User} label="Username" placeholder="parent@monto.ai" />
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password</Label>
            <div className="relative">
              <Lock className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input type={showPw ? "text" : "password"} placeholder="••••••••" className="h-12 rounded-2xl pl-10 pr-10" defaultValue="password123" />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <button type="button" className="text-xs text-primary font-medium">Change password</button>
          </div>
        </Section>

        <Section title="Child Information">
          <Field icon={Baby} label="Child Name" placeholder="e.g. Aarav" />
          <div className="grid grid-cols-2 gap-3">
            <Field icon={Hash} label="Age" placeholder="8" type="number" />
            <Field icon={GraduationCap} label="Class" placeholder="Grade 3" />
          </div>
        </Section>

        <Button type="submit" className="w-full h-12 rounded-2xl brand-gradient text-white shadow-elevated">
          Login & Continue
        </Button>
      </form>
    </PhoneShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-card border p-5 shadow-card space-y-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Field({ icon: Icon, label, ...props }: { icon: React.ComponentType<{ className?: string }>; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="relative">
        <Icon className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input className="h-12 rounded-2xl pl-10" {...props} />
      </div>
    </div>
  );
}
