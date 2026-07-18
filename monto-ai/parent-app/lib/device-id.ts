const STORAGE_KEY = "monto_parent_device_id";

/** Returns this phone's persistent device ID, generating one on first run.
 * Sent to the backend when redeeming a pairing code so Supabase can record
 * which parent device paired with which child device. */
export function getOrCreateParentDeviceId(): string {
  if (typeof window === "undefined") return "parent-device";

  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `parent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
