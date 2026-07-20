const STORAGE_KEY = "monto_child_name";

/** The child's own name, set remotely by the parent app right after pairing
 * (see the "paired" message on the `${deviceId}:control` channel). */
export function loadChildName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveChildName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    /* ignore */
  }
}
