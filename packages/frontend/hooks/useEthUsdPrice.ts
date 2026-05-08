"use client";

import { useEffect, useState } from "react";

const PRICE_URL = "/api/eth-price";
const CACHE_KEY = "baseplay:eth-usd";
const CACHE_TTL = 5 * 60_000;

let inFlight: Promise<number | null> | null = null;

export function useEthUsdPrice(enabled = true) {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const cached = readCache();
    if (cached) setPrice(cached.price);

    async function load() {
      try {
        inFlight ??= fetch(PRICE_URL, { cache: "force-cache" })
          .then((response) => (response.ok ? response.json() : null))
          .then((data: { price?: number | null } | null) => {
            const nextPrice = data?.price ?? null;
            if (!Number.isFinite(nextPrice)) return null;
            window.localStorage.setItem(CACHE_KEY, JSON.stringify({ price: nextPrice, ts: Date.now() }));
            return nextPrice;
          })
          .finally(() => {
            inFlight = null;
          });
        const nextPrice = await inFlight;
        if (!Number.isFinite(nextPrice)) return;
        if (!cancelled) setPrice(nextPrice ?? null);
      } catch {
        // USD display is supplemental; keep ETH-only UI if the public price API is unavailable.
      }
    }

    if (!cached || Date.now() - cached.ts > CACHE_TTL) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return price;
}

function readCache() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { price?: number; ts?: number };
    if (!Number.isFinite(parsed.price) || !Number.isFinite(parsed.ts)) return null;
    return { price: parsed.price!, ts: parsed.ts! };
  } catch {
    return null;
  }
}
