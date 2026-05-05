"use client";

import { useEffect, useState } from "react";

const PRICE_URL = "/api/eth-price";
const CACHE_KEY = "baseplay:eth-usd";
const CACHE_TTL = 60_000;

export function useEthUsdPrice() {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cached = readCache();
    if (cached) setPrice(cached.price);

    async function load() {
      try {
        const response = await fetch(PRICE_URL, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { price?: number | null };
        const nextPrice = data.price;
        if (!Number.isFinite(nextPrice)) return;
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({ price: nextPrice, ts: Date.now() }));
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
  }, []);

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
