/**
 * Centralized API client for making requests to the backend
 * Handles environment-aware base URL configuration for production/development
 */

// Get API base URL from environment variable
// In development: Uses Vite proxy (empty string means relative URLs work)
// In production: Uses full backend URL (e.g., https://api.yourdomain.com)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Constructs full API URL from path
 * @param path - API endpoint path (e.g., "/api/auth/login")
 * @returns Full URL for the API endpoint
 */
export function getApiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // In development (no VITE_API_BASE_URL), return relative path for Vite proxy
  if (!API_BASE_URL) {
    return `/${cleanPath}`;
  }
  
  // In production, construct full URL
  return `${API_BASE_URL}/${cleanPath}`;
}

/**
 * Turn a stored avatar/document path into a URL the browser can load.
 * Relative paths like `/objects/uploads/...` stay same-origin in dev (Vite proxy);
 * with VITE_API_BASE_URL they point at the API host.
 */
export function resolveAuthenticatedMediaUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) {
    return s;
  }
  const path = s.startsWith("/") ? s.slice(1) : s;
  return getApiUrl(path);
}

/**
 * Makes an authenticated API request with credentials
 * @param path - API endpoint path
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function apiRequest(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const url = getApiUrl(path);
  
  const { timeoutMs, ...fetchOptions } = options;

  const defaultOptions: RequestInit = {
    credentials: 'include', // CRITICAL: Send cookies with cross-origin requests
    headers: {
      'Content-Type': 'application/json',
      ...(fetchOptions as RequestInit).headers,
    },
  };

  // Optional timeout support via AbortController.
  // If a caller supplies its own signal, we forward aborts into the timeout controller.
  const controller = timeoutMs ? new AbortController() : undefined;
  let timeoutId: number | undefined;
  const callerSignal = (fetchOptions as RequestInit).signal;

  if (controller && callerSignal) {
    if (callerSignal.aborted) {
      controller.abort((callerSignal as any).reason);
    } else {
      callerSignal.addEventListener(
        'abort',
        () => controller.abort((callerSignal as any).reason),
        { once: true }
      );
    }
  }

  if (controller && typeof timeoutMs === 'number' && timeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      controller.abort(new DOMException('Request timed out', 'TimeoutError'));
    }, timeoutMs);
  }

  try {
    return await fetch(url, {
      ...defaultOptions,
      ...(fetchOptions as RequestInit),
      signal: controller?.signal ?? (fetchOptions as RequestInit).signal,
      headers: {
        ...defaultOptions.headers,
        ...(fetchOptions as RequestInit).headers,
      },
    });
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Makes a GET request
 */
export async function apiGet(
  path: string,
  options: { timeoutMs?: number } = {}
): Promise<Response> {
  return apiRequest(path, { method: 'GET', ...options });
}

/**
 * Makes a POST request
 */
export async function apiPost(
  path: string,
  data?: unknown,
  options: { timeoutMs?: number } = {},
): Promise<Response> {
  return apiRequest(path, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

/**
 * Makes a PATCH request
 */
export async function apiPatch(path: string, data?: unknown): Promise<Response> {
  return apiRequest(path, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Makes a PUT request
 */
export async function apiPut(path: string, data?: unknown): Promise<Response> {
  return apiRequest(path, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Makes a DELETE request
 */
export async function apiDelete(path: string): Promise<Response> {
  return apiRequest(path, { method: 'DELETE' });
}

/**
 * Helper to parse JSON response with error handling
 */
export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const errorText = await response.text().catch(() => response.statusText);
  let payload: unknown = null;
  if (errorText) {
    try {
      payload = JSON.parse(errorText);
    } catch {
      payload = errorText;
    }
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : errorText || response.statusText;
    throw new Error(message);
  }
  return payload as T;
}

/**
 * Makes an API request and returns parsed JSON
 */
export async function apiRequestJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiRequest(path, options);
  return parseJsonResponse<T>(response);
}
