import type { Metadata } from "next";
import { VoiceMessagesScreen } from "@/components/VoiceMessagesScreen";

export const metadata: Metadata = {
  title: "Voice Messages — Monto Parent",
};

export default function VoicePage() {
  return <VoiceMessagesScreen />;
}
