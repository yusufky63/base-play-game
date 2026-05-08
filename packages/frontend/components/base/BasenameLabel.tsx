"use client";

import { useEffect, useState } from "react";
import { shortenAddress } from "@/lib/formatters";

const STORAGE_KEY = "baseplay:basename:v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60_000;
const cache = new Map<string, { name: string | null; expiresAt: number }>();
const pending = new Map<string, Promise<string | null>>();

export function BasenameLabel({ address, className, chars = 3 }: { address: `0x${string}`; className?: string; chars?: number }) {
  const [name, setName] = useState<string | null>(() => readCachedName(address.toLowerCase()) ?? null);

  useEffect(() => {
    const key = address.toLowerCase();
    const cached = readCachedName(key);
    if (cached !== undefined) {
      setName(cached);
      return;
    }

    let cancelled = false;
    void loadBasename(key, address).then((nextName) => {
      if (!cancelled) setName(nextName);
    });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return <span className={className}>{name || shortenAddress(address, chars)}</span>;
}

function readCachedName(key: string) {
  const memory = cache.get(key);
  if (memory && memory.expiresAt > Date.now()) return memory.name;
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${key}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { name?: string | null; expiresAt?: number };
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt! <= Date.now()) return undefined;
    const entry = { name: parsed.name ?? null, expiresAt: parsed.expiresAt! };
    cache.set(key, entry);
    return entry.name;
  } catch {
    return undefined;
  }
}

async function loadBasename(key: string, address: string) {
  let request = pending.get(key);
  if (!request) {
    request = fetch(`/api/basename/${address}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { name?: string | null } | null) => {
        const nextName = data?.name ?? null;
        const entry = { name: nextName, expiresAt: Date.now() + CACHE_TTL_MS };
        cache.set(key, entry);
        try {
          window.localStorage.setItem(`${STORAGE_KEY}:${key}`, JSON.stringify(entry));
        } catch {
          // Basename display is cosmetic; in-memory cache is enough if storage is full.
        }
        return nextName;
      })
      .catch(() => {
        const entry = { name: null, expiresAt: Date.now() + 60 * 60_000 };
        cache.set(key, entry);
        return null;
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, request);
  }
  return request;
}
