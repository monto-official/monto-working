import type { Metadata } from "next";
import { BedtimeScreen } from "@/components/BedtimeScreen";

export const metadata: Metadata = {
  title: "Bedtime — Monto Parent",
};

export default function BedtimePage() {
  return <BedtimeScreen />;
}
