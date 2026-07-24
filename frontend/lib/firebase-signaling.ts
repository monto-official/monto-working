/** Firebase Realtime Database signaling transport for WebRTC calls.
 * Media never passes through Firebase; only ring/SDP/ICE/control messages do.
 * Uses Firebase's REST + streaming APIs to avoid a large client SDK in WebViews.
 */

export type CallRole = "child" | "parent";
export type SignalPayload = Record<string, unknown>;

export interface FirebaseSignalingChannel {
  send: (type: string, payload?: SignalPayload) => Promise<void>;
  close: () => void;
}

interface FirebaseSignal {
  role: CallRole;
  type: string;
  payload?: SignalPayload;
  createdAt?: number;
}

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? "";
const databaseUrl = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.trim() ?? "").replace(/\/$/, "");
let tokenCache: { token: string; expiresAt: number } | null = null;

export function isFirebaseSignalingConfigured(): boolean {
  return Boolean(apiKey && databaseUrl);
}

function safeRoom(room: string): string {
  return room.replace(/[.#$\[\]/]/g, "_").slice(0, 180);
}

async function getAnonymousIdToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!response.ok) throw new Error(`Firebase anonymous authentication failed (${response.status})`);

  const data = await response.json() as { idToken?: string; expiresIn?: string };
  if (!data.idToken) throw new Error("Firebase authentication returned no ID token");
  tokenCache = {
    token: data.idToken,
    expiresAt: Date.now() + Number(data.expiresIn ?? 3600) * 1000,
  };
  return data.idToken;
}

function endpoint(path: string, token: string): string {
  return `${databaseUrl}/${path}.json?auth=${encodeURIComponent(token)}`;
}

async function write(path: string, token: string, method: "PUT" | "POST" | "DELETE", body?: unknown): Promise<void> {
  const response = await fetch(endpoint(path, token), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive: method === "PUT",
  });
  if (!response.ok) throw new Error(`Firebase database write failed (${response.status})`);
}

export async function sendFirebaseSignal(
  roomName: string,
  role: CallRole,
  type: string,
  payload: SignalPayload = {},
): Promise<void> {
  if (!isFirebaseSignalingConfigured()) throw new Error("Firebase signaling is not configured");
  const token = await getAnonymousIdToken();
  const room = safeRoom(roomName);
  await write(`montoCalls/${room}/signals`, token, "POST", {
    role,
    type,
    payload,
    createdAt: Date.now(),
  } satisfies FirebaseSignal);
}
export async function createFirebaseSignaling(options: {
  room: string;
  role: CallRole;
  onSignal: (type: string, payload: SignalPayload) => void | Promise<void>;
  onPeerOnline: (online: boolean) => void;
  onError?: (message: string) => void;
}): Promise<FirebaseSignalingChannel> {
  if (!isFirebaseSignalingConfigured()) throw new Error("Firebase signaling is not configured");

  const token = await getAnonymousIdToken();
  const room = safeRoom(options.room);
  const peerRole: CallRole = options.role === "child" ? "parent" : "child";
  const signalsPath = `montoCalls/${room}/signals`;
  const myPresencePath = `montoCalls/${room}/presence/${options.role}`;
  const peerPresencePath = `montoCalls/${room}/presence/${peerRole}`;
  const startedAt = Date.now() - 2_000;
  // The call screen may mount just after navigation; retain only fresh rings.
  const ringStartedAt = Date.now() - 45_000;
  const seen = new Set<string>();
  let closed = false;
  let peerLastSeen = 0;

  const processSignal = (key: string, signal: FirebaseSignal | null) => {
    if (!signal || seen.has(key) || signal.role === options.role) return;
    seen.add(key);
    const cutoff = signal.type === "ring" ? ringStartedAt : startedAt;
    if ((signal.createdAt ?? 0) < cutoff) return;
    void options.onSignal(signal.type, signal.payload ?? {});
  };

  const signalStream = new EventSource(endpoint(signalsPath, token));
  const handleSignalEvent = (event: MessageEvent<string>) => {
    try {
      const change = JSON.parse(event.data) as { path: string; data: FirebaseSignal | Record<string, FirebaseSignal> | null };
      if (change.path === "/" && change.data && typeof change.data === "object") {
        Object.entries(change.data as Record<string, FirebaseSignal>).forEach(([key, value]) => processSignal(key, value));
      } else if (change.path.startsWith("/") && change.path.split("/").length === 2) {
        processSignal(change.path.slice(1), change.data as FirebaseSignal | null);
      }
    } catch {
      options.onError?.("Invalid Firebase signaling event");
    }
  };
  signalStream.addEventListener("put", handleSignalEvent as EventListener);
  signalStream.addEventListener("patch", handleSignalEvent as EventListener);
  signalStream.onerror = () => {
    if (!closed) options.onError?.("Firebase signaling reconnecting…");
  };

  const presenceStream = new EventSource(endpoint(peerPresencePath, token));
  const handlePresence = (event: MessageEvent<string>) => {
    try {
      const change = JSON.parse(event.data) as { data?: { online?: boolean; lastSeen?: number } | null };
      if (change.data?.online && typeof change.data.lastSeen === "number") {
        peerLastSeen = change.data.lastSeen;
        options.onPeerOnline(Date.now() - peerLastSeen < 30_000);
      } else {
        peerLastSeen = 0;
        options.onPeerOnline(false);
      }
    } catch {
      options.onPeerOnline(false);
    }
  };
  presenceStream.addEventListener("put", handlePresence as EventListener);
  presenceStream.addEventListener("patch", handlePresence as EventListener);

  const heartbeat = async () => {
    if (closed) return;
    await write(myPresencePath, token, "PUT", { online: true, lastSeen: Date.now() });
  };
  await heartbeat();
  const heartbeatTimer = setInterval(() => void heartbeat().catch(() => options.onError?.("Firebase presence update failed")), 10_000);
  const freshnessTimer = setInterval(() => {
    if (peerLastSeen && Date.now() - peerLastSeen >= 30_000) options.onPeerOnline(false);
  }, 5_000);

  return {
    send: async (type, payload = {}) => {
      if (type === "ring") await write(signalsPath, token, "DELETE");
      await write(signalsPath, token, "POST", {
        role: options.role,
        type,
        payload,
        createdAt: Date.now(),
      } satisfies FirebaseSignal);
    },
    close: () => {
      if (closed) return;
      closed = true;
      signalStream.close();
      presenceStream.close();
      clearInterval(heartbeatTimer);
      clearInterval(freshnessTimer);
      void write(myPresencePath, token, "PUT", { online: false, lastSeen: Date.now() }).catch(() => {});
    },
  };
}
