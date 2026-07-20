import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DeviceChannelProvider } from "@/components/DeviceChannelProvider";

export const metadata: Metadata = {
  title: "Monto AI — Child-Safe Voice Companion",
  description:
    "Monto is a child-safe AI companion for kids aged 5–15. Speak naturally, learn joyfully.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4F46E5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <DeviceChannelProvider>{children}</DeviceChannelProvider>
      </body>
    </html>
  );
}
