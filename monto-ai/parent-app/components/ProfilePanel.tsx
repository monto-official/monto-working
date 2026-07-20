"use client";
/**
 * ProfilePanel — lets a parent view/edit their child's profile and their own
 * contact info. Child/contact info is local-only; the account itself lives in
 * Supabase Auth (see /signup, /login) — "Sign Out" clears that session.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CHILD, DEFAULT_PARENT,
  loadChildProfile, saveChildProfile,
  loadParentAccount, saveParentAccount,
} from "@/lib/profile-storage";
import { clearAuthSession } from "@/lib/auth-storage";
import { ChildAvatar } from "@/components/ChildAvatar";
import type { ChildProfile, ParentAccount } from "@/types";

const AVATAR_OPTIONS = ["🧒", "👦", "👧", "👶", "🦊", "🐻", "🐰", "🌟"];
const PARENT_AVATAR_OPTIONS = ["🧑", "👩", "👨", "🧔", "👩‍🦱", "👨‍🦱", "👩‍🦰", "🧕", "👳", "👩‍🦳", "👨‍🦳", "🧑‍🦲"];

export function ProfilePanel() {
  const router = useRouter();
  const [child, setChild] = useState<ChildProfile>(DEFAULT_CHILD);
  const [parent, setParent] = useState<ParentAccount>(DEFAULT_PARENT);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setChild(loadChildProfile());
    setParent(loadParentAccount());
  }, []);

  const handleSaveChild = useCallback(() => {
    saveChildProfile(child);
    toast.success("Profile updated");
  }, [child]);

  const handleSaveParent = useCallback(() => {
    saveParentAccount(parent);
    toast.success("Parent account updated");
  }, [parent]);

  const handleDelete = useCallback(() => {
    saveChildProfile(DEFAULT_CHILD);
    saveParentAccount(DEFAULT_PARENT);
    setChild(DEFAULT_CHILD);
    setParent(DEFAULT_PARENT);
    toast.success("Profile data cleared");
    setConfirmDelete(false);
    router.push("/");
  }, [router]);

  return (
    <PhoneShell>
      <PageHeader title="Profile" />
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div className="rounded-3xl brand-gradient text-white p-6 text-center shadow-elevated">
          <div className="size-20 rounded-3xl bg-white/20 backdrop-blur mx-auto flex items-center justify-center text-4xl overflow-hidden">
            <ChildAvatar child={child} />
          </div>
          <h2 className="mt-3 text-xl font-bold">{child.name || "Add your child's name"}</h2>
          <p className="text-sm opacity-90">
            {[child.age && `Age ${child.age}`, child.grade].filter(Boolean).join(" • ") || "Fill in the details below"}
          </p>
        </div>

        <Section title="Child Information">
          <div className="flex flex-wrap gap-2">
            {child.photo && (
              <button
                type="button"
                onClick={() => setChild((c) => ({ ...c, avatar: "photo" }))}
                aria-label="Use profile photo"
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full overflow-hidden border-2 transition-colors",
                  child.avatar === "photo" ? "border-primary" : "border-border hover:border-muted-foreground"
                )}
              >
                <img src={child.photo} alt="" className="w-full h-full object-cover" />
              </button>
            )}
            {AVATAR_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setChild((c) => ({ ...c, avatar: emoji }))}
                aria-label={`Choose avatar ${emoji}`}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-xl border transition-colors",
                  child.avatar === emoji ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>

          <Field label="Child Name" value={child.name} onChange={(v) => setChild((c) => ({ ...c, name: v }))} placeholder="e.g. Aarav Sharma" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age" type="number" value={child.age} onChange={(v) => setChild((c) => ({ ...c, age: v }))} placeholder="8" />
            <Field label="Grade" value={child.grade} onChange={(v) => setChild((c) => ({ ...c, grade: v }))} placeholder="Grade 3" />
          </div>
          <Button onClick={handleSaveChild} className="w-full h-11 rounded-2xl">
            Update Profile
          </Button>
        </Section>

        <Section title="Parent Account">
          <div className="flex items-center gap-3">
            <div className="size-14 rounded-full brand-gradient flex items-center justify-center text-3xl shrink-0">
              {parent.avatar || "🧑"}
            </div>
            <div className="flex flex-wrap gap-2">
              {PARENT_AVATAR_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setParent((p) => ({ ...p, avatar: emoji }))}
                  aria-label={`Choose avatar ${emoji}`}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-lg border transition-colors",
                    parent.avatar === emoji ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <Field label="Your Name" value={parent.name} onChange={(v) => setParent((p) => ({ ...p, name: v }))} placeholder="e.g. Priya Sharma" />
          <Field label="Email" type="email" value={parent.email} onChange={(v) => setParent((p) => ({ ...p, email: v }))} placeholder="you@example.com" />
          <Button variant="outline" onClick={handleSaveParent} className="w-full h-11 rounded-2xl">
            Save Contact Info
          </Button>
        </Section>

        <div className="rounded-3xl bg-card border p-5 shadow-card">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="size-4 text-primary" /> Privacy & Safety
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            All AI conversations are end-to-end encrypted and reviewed for safety.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            clearAuthSession();
            router.replace("/signup");
          }}
          className="w-full h-11 rounded-2xl"
        >
          <LogOut className="size-4" /> Sign Out
        </Button>

        <div className="rounded-3xl border-2 border-destructive/30 bg-destructive/5 p-5">
          <h3 className="text-sm font-bold text-destructive">Danger Zone</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Clearing profile data removes your child&apos;s profile and contact info from this device.
          </p>
          <Button
            variant="outline"
            onClick={() => setConfirmDelete(true)}
            className="w-full h-11 rounded-2xl border-destructive text-destructive hover:bg-destructive hover:text-white"
          >
            <Trash2 className="size-4" /> Clear Profile Data
          </Button>
        </div>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <h2 className="text-lg font-bold">Clear profile data?</h2>
        <p className="text-sm text-muted-foreground mt-2">
          This removes your child&apos;s profile and parent contact info from this device. This can&apos;t be undone.
        </p>
        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1 h-11 rounded-2xl">
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} className="flex-1 h-11 rounded-2xl">
            Clear Data
          </Button>
        </div>
      </Modal>

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

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-xl"
      />
    </div>
  );
}
