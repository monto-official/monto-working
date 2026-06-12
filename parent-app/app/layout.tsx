import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:       "Monto Parent",
  description: "Parent app — call and receive calls from the Monto AI box",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-monto-dark text-white antialiased">
        {children}
      </body>
    </html>
  );
}
