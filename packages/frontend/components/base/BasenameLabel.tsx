"use client";

import { useEffect, useState } from "react";
import { shortenAddress } from "@/lib/formatters";

const cache = new Map<string, string | null>();

export function BasenameLabel({ address, className, chars = 3 }: { address: `0x${string}`; className?: string; chars?: number }) {
  const [name, setName] = useState<string | null>(() => cache.get(address.toLowerCase()) ?? null);

  useEffect(() => {
    const key = address.toLowerCase();
    if (cache.has(key)) {
      setName(cache.get(key) ?? null);
      return;
    }

    let cancelled = false;
    fetch(`/api/basename/${address}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { name?: string | null } | null) => {
        const nextName = data?.name ?? null;
        cache.set(key, nextName);
        if (!cancelled) setName(nextName);
      })
      .catch(() => {
        cache.set(key, null);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return <span className={className}>{name || shortenAddress(address, chars)}</span>;
}
