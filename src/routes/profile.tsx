import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, Trash2, Shield } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Monto Parent" }] }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const navigate = useNavigate();
  return (
    <PhoneShell>
      <PageHeader title="Profile" />
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div className="rounded-3xl brand-gradient text-white p-6 text-center shadow-elevated">
          <div className="size-20 rounded-3xl bg-white/20 backdrop-blur mx-auto flex items-center justify-center text-4xl">👦</div>
          <h2 className="mt-3 text-xl font-bold">Aarav Sharma</h2>
          <p className="text-sm opacity-90">Age 8 • Grade 3</p>
        </div>

        <Section title="Child Information">
          <Field label="Child Name" defaultValue="Aarav Sharma" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age" defaultValue="8" type="number" />
            <Field label="Class" defaultValue="Grade 3" />
          </div>
          <Button onClick={() => toast.success("Profile updated")} className="w-full h-11 rounded-2xl brand-gradient text-white">Update Profile</Button>
        </Section>

        <Section title="Parent Account">
          <Field label="Username" defaultValue="parent@monto.ai" />
          <Field label="New Password" type="password" placeholder="••••••••" />
          <Button variant="outline" onClick={() => toast.success("Password updated")} className="w-full h-11 rounded-2xl">Change Password</Button>
        </Section>

        <div className="rounded-3xl bg-card border p-5 shadow-card">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Shield className="size-4 text-primary" /> Privacy & Safety</h3>
          <p className="text-xs text-muted-foreground mt-1">All AI conversations are end-to-end encrypted and reviewed for safety.</p>
        </div>

        <Button variant="outline" onClick={() => navigate({ to: "/" })} className="w-full h-11 rounded-2xl">
          <LogOut className="size-4" /> Sign Out
        </Button>

        <div className="rounded-3xl border-2 border-destructive/30 bg-destructive/5 p-5">
          <h3 className="text-sm font-bold text-destructive">Danger Zone</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-3">Deleting your account removes all data, recordings, and pairing.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full h-11 rounded-2xl border-destructive text-destructive hover:bg-destructive hover:text-white">
                <Trash2 className="size-4" /> Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone. All data will be permanently removed.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { toast.success("Account deleted"); navigate({ to: "/" }); }} className="rounded-xl bg-destructive">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <BottomNav />
    </PhoneShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-card border p-5 shadow-card space-y-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      <Input className="h-11 rounded-xl" {...props} />
    </div>
  );
}
