"use client";

import { useEffect, useState } from "react";

const PRICE_URL = "/api/eth-price";
const CACHE_KEY = "baseplay:eth-usd";
const CACHE_TTL = 5 * 60_000;
const DEFAULT_ETH_PRICE = 2400;

let inFlight: Promise<number | null> | null = null;

export function useEthUsdPrice(enabled = true) {
  const [price, setPrice] = useState<number | null>(DEFAULT_ETH_PRICE);

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
            const nextPrice = data?.price ?? DEFAULT_ETH_PRICE;
            if (!Number.isFinite(nextPrice)) return DEFAULT_ETH_PRICE;
            window.localStorage.setItem(CACHE_KEY, JSON.stringify({ price: nextPrice, ts: Date.now() }));
            return nextPrice;
          })
          .finally(() => {
            inFlight = null;
          });
        const nextPrice = await inFlight;
        if (!Number.isFinite(nextPrice)) return;
        if (!cancelled) setPrice(nextPrice ?? DEFAULT_ETH_PRICE);
      } catch {
        if (!cancelled) setPrice(DEFAULT_ETH_PRICE);
      }
    }

    if (!cached || Date.now() - cached.ts > CACHE_TTL) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return price ?? DEFAULT_ETH_PRICE;
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
