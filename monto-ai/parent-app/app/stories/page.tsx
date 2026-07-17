import type { Metadata } from "next";
import { StoriesPanel } from "@/components/StoriesPanel";

export const metadata: Metadata = {
  title: "Bedtime Stories — Monto Parent",
};

export default function StoriesPage() {
  return <StoriesPanel />;
}
