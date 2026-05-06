import { frontendEnvStatus } from "@/lib/env";

export function getBackendUrl(path: string) {
  const base = frontendEnvStatus.backendUrl.replace(/\/$/, "");
  if (!base) return "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchBackendJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const url = getBackendUrl(path);
  if (!url) return null;

  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Backend request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}
