// ── Call State ────────────────────────────────────────────────────────────────

export type CallState =
  | "unregistered"   // SIP UA not yet connected
  | "registering"    // connecting to Asterisk
  | "registered"     // idle, ready to call/receive
  | "calling"        // outbound call ringing
  | "incoming"       // incoming call ringing
  | "in-call"        // active call
  | "ending"         // hanging up
  | "error";         // fatal error

export type CallDirection = "outbound" | "inbound";

// ── Call Log Entry ────────────────────────────────────────────────────────────

export interface CallLogEntry {
  id: string;
  direction: CallDirection;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  status: "answered" | "missed" | "declined" | "failed";
}

// ── SIP Config ────────────────────────────────────────────────────────────────

export interface SIPConfig {
  wsUrl: string;       // ws://asterisk-host:8088/ws
  username: string;    // SIP username (e.g. "parent")
  password: string;    // SIP password
  domain: string;      // SIP domain / Asterisk host (e.g. "192.168.1.10")
}

// ── Monto Box Status ──────────────────────────────────────────────────────────

export interface MontoBoxStatus {
  online: boolean;
  extension: string;
  lastSeen?: Date;
}
