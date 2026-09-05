"use client";

import { useAuthStore } from "./store/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuth?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const json = await res.json();
        const token = json?.data?.accessToken ?? null;
        if (token) useAuthStore.getState().setAccessToken(token);
        return token;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;
  const accessToken = useAuthStore.getState().accessToken;

  const doFetch = async (token: string | null) => {
    // Every caller passes a bare resource path (e.g. "/api-keys",
    // "/deployments/123") — always version-prefix it. A prior "does this
    // already start with /api?" heuristic collided with resource paths
    // that happen to start with those same four characters (like
    // "/api-keys" itself), silently dropping the /v1 prefix and 404ing.
    return fetch(`${API_URL}/api/v1${path}`, {
      ...rest,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch(accessToken);

  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  const json = await res.json().catch(() => null);

  if (!res.ok || (json && json.success === false)) {
    const message = json?.error?.message ?? `Request failed with status ${res.status}`;
    const code = json?.error?.code ?? "UNKNOWN_ERROR";
    throw new ApiError(res.status, code, message, json?.error?.details);
  }

  return (json?.data ?? json) as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => apiFetch<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(path, { ...opts, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(path, { ...opts, method: "PUT", body }),
  delete: <T>(path: string, opts?: RequestOptions) => apiFetch<T>(path, { ...opts, method: "DELETE" }),
};

export { API_URL };
