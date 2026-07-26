import { getOrCreateParentDeviceId } from "./device-id";
import { sendFirebaseSignal } from "./firebase-signaling";
import { loadAuthSession } from "./auth-storage";

const STORAGE_KEY = "monto_pairings";
const LEGACY_STORAGE_KEY = "monto_pairing";
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_MONTO_API_URL?.replace(/\/$/, "");

function reachableApiUrl(savedUrl: string): string {
  if (!PUBLIC_API_URL) return savedUrl;
  try {
    const host = new URL(savedUrl).hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" ||
      /^10\./.test(host) || /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
    return isLocal ? PUBLIC_API_URL : savedUrl;
  } catch {
    return PUBLIC_API_URL;
  }
}

export interface PairingData {
  deviceId: string;
  apiUrl: string;
  turnUrl?: string;
  turnUsername?: string;
  turnPassword?: string;
}

function isValidPairing(data: any): data is PairingData {
  return typeof data?.deviceId === "string" && typeof data?.apiUrl === "string";
}

function writePairings(pairings: PairingData[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pairings));
}

/** Every Monto box currently paired with this parent account. A parent can
 * pair with any number of boxes — each entry is independent. Migrates the
 * old single-pairing storage (one box only) into this list, once, the first
 * time it's read after upgrading. */
export function loadPairings(): PairingData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(isValidPairing).map((p) => ({ ...p, apiUrl: reachableApiUrl(p.apiUrl) }));
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (isValidPairing(legacy)) {
        writePairings([legacy]);
        return [{ ...legacy, apiUrl: reachableApiUrl(legacy.apiUrl) }];
      }
    }
    return [];
  } catch {
    return [];
  }
}

/** Adds a newly-paired box, or replaces the existing entry if this box was
 * already paired (re-scanning the same code). */
export function addPairing(data: PairingData): void {
  if (typeof window === "undefined") return;
  const existing = loadPairings().filter((p) => p.deviceId !== data.deviceId);
  writePairings([...existing, data]);
}

/** Unpairs one box, leaving any others untouched. */
export function removePairing(deviceId: string): void {
  if (typeof window === "undefined") return;
  writePairings(loadPairings().filter((p) => p.deviceId !== deviceId));
}

/**
 * Restores every box tied to this parent account from the backend (see
 * GET /pairing/mine) and merges them into local storage — so logging into
 * an existing account on a new phone, or after a reinstall, reconnects to
 * already-paired boxes without re-scanning a QR code. Fails soft: any
 * error (offline, not logged in server-side, nothing to restore) just
 * leaves the local list as it was.
 */
export async function restorePairingsFromAccount(accessToken: string): Promise<PairingData[]> {
  if (!PUBLIC_API_URL) return loadPairings();
  try {
    const res = await fetch(`${PUBLIC_API_URL}/pairing/mine`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return loadPairings();
    const rows = await res.json();
    if (!Array.isArray(rows)) return loadPairings();

    for (const row of rows) {
      if (typeof row?.child_device_id !== "string" || typeof row?.api_url !== "string") continue;
      addPairing({
        deviceId: row.child_device_id,
        apiUrl: reachableApiUrl(row.api_url),
        turnUrl: row.turn_url ?? undefined,
        turnUsername: row.turn_username ?? undefined,
        turnPassword: row.turn_password ?? undefined,
      });
    }
  } catch {
    // Best-effort — local pairings (if any) still work regardless.
  }
  return loadPairings();
}

/** Parses a legacy v1 QR payload (credentials embedded directly, no backend
 * round trip). Kept only as a fallback for old child-app builds. */
export function parsePairingPayload(raw: string): PairingData | null {
  try {
    const obj = JSON.parse(raw);
    if (obj?.v === 1 && typeof obj.id === "string" && typeof obj.api === "string") {
      return {
        deviceId: obj.id,
        apiUrl: obj.api,
        turnUrl: typeof obj.turnUrl === "string" ? obj.turnUrl : undefined,
        turnUsername: typeof obj.turnUsername === "string" ? obj.turnUsername : undefined,
        turnPassword: typeof obj.turnPassword === "string" ? obj.turnPassword : undefined,
      };
    }
  } catch {
    /* not JSON, or not a Monto pairing code */
  }
  return null;
}

/**
 * Redeems a scanned QR payload from the current child app (PairingQRModal),
 * which carries only a short-lived code — this exchanges it with the backend
 * (Supabase-backed /pairing/redeem) for the real connection info and records
 * the pairing server-side. Falls back to the legacy v1 direct-embed format
 * if present, with no server round trip.
 */
export async function redeemPairingCode(raw: string): Promise<PairingData> {
  let obj: any;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error("That doesn't look like a Monto pairing code — try again.");
  }

  if (obj?.v === 1) {
    const legacy = parsePairingPayload(raw);
    if (!legacy) throw new Error("That doesn't look like a Monto pairing code — try again.");
    return legacy;
  }

  if (obj?.v !== 2 || typeof obj.code !== "string" || typeof obj.api !== "string") {
    throw new Error("That doesn't look like a Monto pairing code — try again.");
  }

  const redeemApiUrl = reachableApiUrl(obj.api);
  const session = loadAuthSession();
  const res = await fetch(`${redeemApiUrl}/pairing/redeem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    },
    body: JSON.stringify({
      code: obj.code,
      parent_device_id: getOrCreateParentDeviceId(),
    }),
  });

  if (res.status === 404) throw new Error("Pairing code not found — ask the child app to show a fresh QR code.");
  if (res.status === 410) throw new Error("That QR code expired — ask the child app to show a fresh one.");
  if (!res.ok) throw new Error(`Couldn't reach the server (HTTP ${res.status}). Check your connection.`);

  const data = await res.json();
  return {
    deviceId: data.child_device_id,
    apiUrl: data.api_url,
    turnUrl: data.turn_url ?? undefined,
    turnUsername: data.turn_username ?? undefined,
    turnPassword: data.turn_password ?? undefined,
  };
}

/** Redeem the short code shown below the child's QR image. */
export function redeemManualPairingCode(code: string): Promise<PairingData> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized)) {
    throw new Error("Enter the 6-character pairing code shown on the Monto box.");
  }
  if (!PUBLIC_API_URL) {
    throw new Error("The public Monto server is not configured.");
  }
  return redeemPairingCode(JSON.stringify({ v: 2, code: normalized, api: PUBLIC_API_URL }));
}
/**
 * Best-effort push to the child device over the same `${deviceId}:control`
 * channel `useDeviceChannel`/music remote-control uses, so the child app can
 * show its own "paired successfully" moment and learn the name the parent
 * just set for it. Silently does nothing if the child app isn't online right
 * now — pairing itself already succeeded via the backend redeem above.
 */
export function notifyChildPaired(pairing: PairingData, childName: string): void {
  void sendFirebaseSignal(`${pairing.deviceId}:control`, "parent", "paired", { childName }).catch(() => {});
}

/**
 * Wakes up the child app so it opens its own call screen and starts
 * listening on the WebRTC call room — the child app has no persistent
 * connection to that room while it's just sitting idle on the home screen,
 * so a "ring" sent directly there before the child is listening would be
 * dropped. This goes out over the always-on `${deviceId}:control` channel
 * instead (same one used for `notifyChildPaired`/music commands), which the
 * child app keeps connected everywhere.
 */
export function notifyChildIncomingCall(pairing: PairingData, callerName: string, callerAvatar?: string): void {
  void sendFirebaseSignal(`${pairing.deviceId}:control`, "parent", "incoming-call", {
    callerName,
    callerAvatar,
  }).catch(() => {});
}
