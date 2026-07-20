import type { Metadata } from "next";
import { QuestionsScreen } from "@/components/QuestionsScreen";

export const metadata: Metadata = {
  title: "Questions Asked — Monto Parent",
};

export default function QuestionsPage() {
  return <QuestionsScreen />;
}
