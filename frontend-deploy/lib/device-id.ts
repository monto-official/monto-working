const STORAGE_KEY = "monto_device_id";

/**
 * Returns this child device's persistent pairing/sync ID, generating and
 * storing one on first run. This is the ID shown in the pairing QR code and
 * used as the signaling "room" so calls only reach the parent app that
 * scanned it.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "monto-room";

  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  // A deployer-set env var (anything other than the shared placeholder
  // default) seeds the first-run ID; otherwise generate a random one.
  const envSeed = process.env.NEXT_PUBLIC_DEVICE_ID;
  const id =
    envSeed && envSeed !== "monto-room"
      ? envSeed
      : typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `monto-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
