import type { Metadata } from "next";
import { RemindersScreen } from "@/components/RemindersScreen";

export const metadata: Metadata = {
  title: "Reminders — Monto Parent",
};

export default function RemindersPage() {
  return <RemindersScreen />;
}
