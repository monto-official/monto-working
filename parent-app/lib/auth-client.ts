import type { AuthSession } from "./auth-storage";

// Routed through the backend's /auth/* routes (routes/auth.py), which use
// Supabase's service-role key to create pre-confirmed accounts server-side.
// Talking to Supabase's GoTrue REST API directly from here used to break
// whenever the Supabase project had "confirm email" enabled, since signup
// then returns no access_token until the email link is clicked.
const API_URL = (process.env.NEXT_PUBLIC_MONTO_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

interface BackendUser {
  id: string;
  name: string;
  email: string;
}

interface BackendAuthResponse {
  access_token?: string;
  user?: BackendUser;
  detail?: string;
}

async function request(path: string, body: Record<string, unknown>): Promise<BackendAuthResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't connect to the Monto server. Check your connection.");
  }

  let data: BackendAuthResponse = {};
  try {
    data = (await response.json()) as BackendAuthResponse;
  } catch {
    // Keep an empty response so the status-based error remains readable.
  }

  if (!response.ok) {
    throw new Error(data.detail || `Authentication failed (HTTP ${response.status}).`);
  }
  return data;
}

function toSession(data: BackendAuthResponse): AuthSession {
  if (!data.user || !data.access_token) throw new Error("Server did not return a valid session.");
  return {
    accessToken: data.access_token,
    userId: data.user.id,
    name: data.user.name,
    email: data.user.email,
  };
}

export async function signup(name: string, email: string, password: string): Promise<AuthSession> {
  const data = await request("/auth/signup", { name, email, password });
  return toSession(data);
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const data = await request("/auth/login", { email, password });
  return toSession(data);
}
