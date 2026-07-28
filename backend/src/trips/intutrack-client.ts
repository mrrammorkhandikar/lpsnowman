import { z } from "zod";

const baseUrl = process.env.INTUTRACK_BASE_URL || "https://sct.intutrack.com/api/prod";
const username = process.env.INTUTRACK_USERNAME || "";
const password = process.env.INTUTRACK_PASSWORD || "";

// IntuTrack per-request timeout.
// Default 2s — fail fast so background refresh jobs do not accumulate and
// compete with real user traffic on the Node.js event loop.
// If a load's tracking call times out it is simply skipped until the next
// periodic refresh cycle.  Override via INTUTRACK_TIMEOUT env var.
const parsedTimeout = Number.parseInt(process.env.INTUTRACK_TIMEOUT || "2000", 10);
const timeoutMs =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0 && parsedTimeout <= 60000
    ? parsedTimeout
    : 2000;

type HttpMethod = "GET" | "POST" | "PUT";
type AuthMode = "basic" | "bearer";

type RequestOptions = {
  method?: HttpMethod;
  auth?: AuthMode;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Override request timeout (ms). Used e.g. for status calls to avoid blocking the API server. */
  timeoutMs?: number;
};

type TokenCache = {
  token: string;
  expiresAt: number;
};

let cachedToken: TokenCache | null = null;

const loginResponseSchema = z.object({
  token: z.string(),
  user: z
    .object({
      _id: z.string().optional(),
    })
    .optional(),
});

function base64UrlToBase64(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return padded + "=".repeat((4 - (padded.length % 4)) % 4);
}

function decodeJwtExpiry(token: string) {
  const payload = token.split(".")[1];
  if (!payload) return 0;
  const decoded = Buffer.from(base64UrlToBase64(payload), "base64").toString("utf8");
  const json = JSON.parse(decoded);
  if (typeof json.exp !== "number") return 0;
  return json.exp * 1000;
}

function basicAuthHeader() {
  if (!username || !password) {
    throw new Error("INTUTRACK_USERNAME and INTUTRACK_PASSWORD must be set");
  }
  const encoded = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${encoded}`;
}

async function getIntuTrackToken() {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60000) {
    return cachedToken.token;
  }
  const response = await intutrackRequest("/login", { method: "POST", auth: "basic" });
  const parsed = loginResponseSchema.parse(response);
  const expiresAt = decodeJwtExpiry(parsed.token) || Date.now() + 55 * 60 * 1000;
  cachedToken = { token: parsed.token, expiresAt };
  return parsed.token;
}

function buildIntuTrackUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(`${baseUrl}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url;
}

async function buildIntuTrackHeaders(options: RequestOptions) {
  const headers: Record<string, string> = {};
  const auth = options.auth || "bearer";

  if (auth === "basic") {
    headers.Authorization = basicAuthHeader();
  } else {
    const token = await getIntuTrackToken();
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function parseIntuTrackResponse(res: Response) {
  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") && text ? JSON.parse(text) : text;

  if (!res.ok) {
    const error = new Error(`IntuTrack request failed with status ${res.status}`);
    (error as Error & { status?: number; payload?: unknown }).status = res.status;
    (error as Error & { status?: number; payload?: unknown }).payload = payload;
    throw error;
  }

  return payload;
}

function normalizeIntuTrackError(err: unknown, effectiveTimeout: number) {
  const e = err as Error & { code?: string; cause?: Error };
  if (e.name === "AbortError") {
    const timeoutErr = new Error(`IntuTrack request timed out after ${effectiveTimeout / 1000}s`);
    (timeoutErr as Error & { payload?: unknown }).payload = { timeout: true };
    return timeoutErr;
  }
  if (
    e.message === "fetch failed" ||
    e.code === "UND_ERR_CONNECT_TIMEOUT" ||
    e.code === "ECONNREFUSED" ||
    e.code === "ENOTFOUND"
  ) {
    const msg =
      "IntuTrack service unreachable. Check network and that " +
      baseUrl.replace(/^https?:\/\//, "") +
      " is accessible.";
    const networkErr = new Error(msg);
    (networkErr as Error & { payload?: unknown }).payload = {
      originalMessage: e.message,
      code: e.code,
    };
    return networkErr;
  }
  return err;
}

async function intutrackRequest(path: string, options: RequestOptions = {}) {
  const url = buildIntuTrackUrl(path, options.query);
  const method = options.method || "GET";
  const headers = await buildIntuTrackHeaders(options);

  let body: string | undefined;
  if (options.body !== undefined) {
    body = JSON.stringify(options.body);
  }

  const effectiveTimeout = options.timeoutMs ?? timeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    return await parseIntuTrackResponse(res as unknown as Response);
  } catch (err: unknown) {
    throw normalizeIntuTrackError(err, effectiveTimeout);
  } finally {
    clearTimeout(timeout);
  }
}

export async function loginWithDetails() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (!username || !password) {
      throw new Error("INTUTRACK_USERNAME and INTUTRACK_PASSWORD must be set");
    }

    const res = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
      },
      signal: controller.signal,
    });

    const text = await res.text();
    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") && text ? JSON.parse(text) : text;

    if (!res.ok) {
      const error = new Error(`IntuTrack login failed with status ${res.status}`);
      (error as Error & { status?: number; payload?: unknown }).status = res.status;
      (error as Error & { status?: number; payload?: unknown }).payload = payload;
      throw error;
    }

    return payload as { token: string; user?: { _id?: string } } & Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

export async function startTrip(payload: Record<string, unknown>) {
  return intutrackRequest("/trips/start", { method: "POST", body: payload, auth: "bearer" });
}

export async function submitTrip(payload: Record<string, unknown>) {
  return intutrackRequest("/trips/submit", { method: "POST", body: payload, auth: "bearer" });
}

export async function updateTrip(payload: Record<string, unknown>) {
  return intutrackRequest("/trips/", { method: "PUT", body: payload, auth: "basic" });
}

export async function endTrip(intutrackTripId: string) {
  return intutrackRequest(`/trips/end/${intutrackTripId}`, { method: "POST", auth: "bearer" });
}

export async function generatePublicLink(tripId: string) {
  return intutrackRequest("/trips/generatepubliclink", {
    method: "POST",
    body: { tripId },
    auth: "bearer",
  });
}

export async function getConsents(tel: string) {
  return intutrackRequest("/consents", { method: "GET", query: { tel }, auth: "bearer" });
}

const statusTimeoutMs = Number.parseInt(process.env.INTUTRACK_STATUS_TIMEOUT_MS || "5000", 10);

export async function getLocations(tripId: string, limit?: number) {
  console.log("[IntuTrack] getLocations: calling /status for tripId =", tripId, "limit =", limit);
  const payload = await intutrackRequest("/status", {
    method: "GET",
    query: { tripId, limit },
    auth: "bearer",
    timeoutMs: statusTimeoutMs,
  });
  const items = Array.isArray(payload)
    ? payload
    : payload && Array.isArray((payload as any).result)
      ? (payload as any).result
      : [];
  console.log(
    "[IntuTrack] getLocations: received",
    items.length,
    "items for tripId =",
    tripId,
  );
  return payload;
}
