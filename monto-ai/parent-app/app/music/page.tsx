import type { Metadata } from "next";
import { MusicScreen } from "@/components/MusicScreen";

export const metadata: Metadata = {
  title: "Music — Monto Parent",
};

export default function MusicPage() {
  return <MusicScreen />;
}
