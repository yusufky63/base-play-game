"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { RoundDetailBody } from "@/components/rounds/RoundDetailDrawer";
import { fetchRoundDetails } from "@/lib/roundDetails";

export function RoundDetailPageClient({ chainId, requestId }: { chainId: number; requestId: string }) {
  const details = useQuery({
    queryKey: ["round-details-page", chainId, requestId],
    queryFn: () => fetchRoundDetails({ chainId, requestId }),
    staleTime: 30 * 60_000,
    gcTime: 3 * 60 * 60_000,
    refetchOnWindowFocus: false
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mb-7 flex flex-col gap-4 border-b border-[var(--border)] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/live-feed" className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase text-[var(--text-3)] hover:text-[var(--accent)]">
            <ArrowLeft size={13} />
            Live feed
          </Link>
          <h1 className="display-heading text-4xl font-bold text-[var(--text-1)]">Round verification</h1>
          <p className="mt-2 font-mono text-xs text-[var(--text-3)]">
            Chain {chainId} · request {requestId}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void details.refetch()}
          className="control-shell flex items-center gap-2 px-3 text-xs font-bold"
        >
          <RefreshCw size={13} className={details.isFetching ? "animate-spin text-[var(--accent)]" : ""} />
          Refresh
        </button>
      </div>

      <section className="round-page-panel">
        <RoundDetailBody
          details={details.data ?? { round: null, events: [], source: "unavailable" }}
          loading={details.isLoading}
          fallbackChainId={chainId}
          fallbackRequestId={requestId}
        />
      </section>
    </main>
  );
}
