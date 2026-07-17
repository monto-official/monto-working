import type { Metadata } from "next";
import { ProfilePanel } from "@/components/ProfilePanel";

export const metadata: Metadata = {
  title: "Profile — Monto Parent",
};

export default function ProfilePage() {
  return <ProfilePanel />;
}
