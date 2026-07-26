const KEY = "monto_active_call_device";

/** Which paired box's call is currently occupying the Call screen, if any —
 * shared between IncomingCallRouter (deciding whether a new ring should
 * interrupt) and CallScreen (clearing it once that call ends). Session-only:
 * a call in progress shouldn't survive a full app restart. */
export function getActiveCallDevice(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}

export function setActiveCallDevice(deviceId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, deviceId);
}

/** Clears the active-call flag only if it still matches this device, so an
 * older/unrelated call ending can't clobber a newer one that started since. */
export function clearActiveCallDevice(deviceId?: string): void {
  if (typeof window === "undefined") return;
  if (!deviceId || sessionStorage.getItem(KEY) === deviceId) {
    sessionStorage.removeItem(KEY);
  }
}
