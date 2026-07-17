import type { Metadata } from "next";
import { RecordingsScreen } from "@/components/RecordingsScreen";

export const metadata: Metadata = {
  title: "Recordings — Monto Parent",
};

export default function RecordingsPage() {
  return <RecordingsScreen />;
}
