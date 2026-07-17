import type { Metadata } from "next";
import { CallScreen } from "@/components/CallScreen";

export const metadata: Metadata = {
  title: "Call AI Box — Monto Parent",
};

export default function CallPage() {
  return <CallScreen />;
}
