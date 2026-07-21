/**
 * Resolves the backend base URL.
 *
 * If NEXT_PUBLIC_API_URL is set at build time, that always wins (production
 * deploys). Otherwise, falls back to whatever host this page was loaded
 * from — so opening the child app via the machine's LAN IP (instead of
 * "localhost") makes every API call, WS connection, and the pairing QR
 * itself point at that same LAN IP. That's what lets the parent app pair
 * from a different device on the same wifi, and keeps working after
 * switching wifi networks without editing any .env file.
 */
export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") return `http://${window.location.hostname}:8000`;
  return "http://localhost:8000";
}
