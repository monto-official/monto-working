import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { BackButtonGuard } from "@/components/BackButtonGuard";
import { AuthGate } from "@/components/AuthGate";
import { IncomingCallRouter } from "@/components/IncomingCallRouter";
import { VoiceMessageRouter } from "@/components/VoiceMessageRouter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monto Parent — AI Box Companion",
  description: "Manage your child's Monto AI Box: usage, reminders, calls, music, and bedtime stories.",
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
        />
      </head>
      <body className="antialiased">
        <AuthGate>{children}</AuthGate>
        <IncomingCallRouter />
        <VoiceMessageRouter />
        <Toaster position="top-center" />
        <BackButtonGuard />
      </body>
    </html>
  );
}
