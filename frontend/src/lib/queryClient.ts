import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "./api-client";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  customHeaders?: Record<string, string>,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...customHeaders,
  };
  
  // Convert relative URL to absolute if needed
  const fullUrl = url.startsWith('http') ? url : getApiUrl(url);
  
  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    cache: method === "GET" ? "no-store" : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

// Generate a unique idempotency key for invoice operations
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey.join("/");
    const fullUrl = path.startsWith('http') ? path : getApiUrl(path);
    
    const res = await fetch(fullUrl, {
      credentials: "include",
      cache: "no-store",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5000, // 5 seconds default for fresher data
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Clear all cached data for faster fresh loads
export function clearQueryCache() {
  queryClient.clear();
}

// Invalidate all queries to trigger refetch
export function invalidateAllQueries() {
  queryClient.invalidateQueries();
}

// Clear specific query caches by key prefix
export function clearCacheByPrefix(prefix: string) {
  queryClient.removeQueries({ 
    predicate: (query) => 
      query.queryKey.some(key => 
        typeof key === 'string' && key.startsWith(prefix)
      )
  });
}
