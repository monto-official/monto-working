/**
 * Monto Parent App — Main Page
 *
 * A minimal, focused calling interface for parents to:
 *   1. Call the Monto AI box (child's device)
 *   2. Receive calls initiated from the Monto AI box
 *
 * VoIP is handled by Asterisk + JsSIP (WebRTC over WebSocket).
 */
import { CallPanel } from "@/components/CallPanel";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-monto-dark">
      {/* Radial glow — subtle ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, #7C3AED 0%, transparent 70%)",
          }}
        />
      </div>

      <CallPanel />
    </main>
  );
}
