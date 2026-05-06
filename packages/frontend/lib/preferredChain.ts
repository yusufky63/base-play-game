import { useEffect, useState } from "react";
import { defaultChainId } from "@/lib/env";

export function getPreferredChainId() {
  if (typeof window === "undefined") return defaultChainId;
  const stored = Number(window.localStorage.getItem("baseplay:chainId"));
  return Number.isFinite(stored) && stored > 0 ? stored : defaultChainId;
}

export function usePreferredChainId(fallbackChainId: number = defaultChainId) {
  const [chainId, setChainId] = useState(() => (typeof window === "undefined" ? fallbackChainId : getPreferredChainId()));

  useEffect(() => {
    setChainId(getPreferredChainId());

    function onChainChange(event: Event) {
      const next = event instanceof CustomEvent && typeof event.detail === "number" ? event.detail : getPreferredChainId();
      setChainId(next);
    }

    function onStorage(event: StorageEvent) {
      if (event.key === "baseplay:chainId") setChainId(getPreferredChainId());
    }

    window.addEventListener("baseplay:chain-change", onChainChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("baseplay:chain-change", onChainChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [fallbackChainId]);

  return chainId;
}
