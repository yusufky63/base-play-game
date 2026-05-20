"use client";

import { useState } from "react";
import { ExternalLink, Loader2, RadioTower, RefreshCw, ShieldCheck } from "lucide-react";
import { parseEther } from "viem";
import { usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { AdminMetric, AdminShell } from "@/components/admin/AdminShell";
import { useAdminOps } from "@/hooks/useAdminOps";
import { BASEPLAY_BUILDER_CODE_SUFFIX } from "@/lib/builderCode";
import { formatUsd, shortenAddress } from "@/lib/formatters";
import { getDefaultNetworkConfig } from "@/lib/networkConfig";

const ETH_USD_REFERENCE = 2187;
const defaultNetwork = getDefaultNetworkConfig();
const vrfAbi = [
  { type: "function", name: "fundSubscriptionWithNative", stateMutability: "payable", inputs: [{ name: "subId", type: "uint256" }], outputs: [] }
] as const;

export default function AdminVrfPage() {
  const ops = useAdminOps();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [fundEth, setFundEth] = useState("0.01");
  const vrf = ops.data?.vrf ?? null;

  async function fundVrfNative() {
    if (!vrf) return;
    const value = parseEthInput(fundEth);
    if (value === null) return;
    await switchChainAsync({ chainId: defaultNetwork.chainId });
    const hash = await writeContractAsync({
      address: vrf.coordinator,
      abi: vrfAbi,
      functionName: "fundSubscriptionWithNative",
      args: [BigInt(vrf.subscriptionId)],
      value,
      dataSuffix: BASEPLAY_BUILDER_CODE_SUFFIX
    });
    await publicClient?.waitForTransactionReceipt({ hash });
    await ops.refetch();
  }

  function parseEthInput(value: string) {
    try {
      const parsed = parseEther(value);
      return parsed > 0n ? parsed : null;
    } catch {
      return null;
    }
  }

  return (
    <AdminShell title="VRF Operations" description="Chainlink VRF subscription health for game settlement and Lucky Draw randomness.">
      <div className="grid gap-3 md:grid-cols-4">
        <AdminMetric label="Native balance" value={`${vrf?.nativeBalanceEth ?? "-"} ETH`} detail={formatEthUsd(vrf?.nativeBalanceEth)} tone={Number(vrf?.nativeBalanceEth ?? 0) > 0.005 ? "win" : "pending"} />
        <AdminMetric label="LINK balance" value={`${vrf?.linkBalance ?? "-"} LINK`} detail="LINK is shown without USD pricing" />
        <AdminMetric label="Requests" value={vrf?.requestCount ?? "-"} detail="Subscription request count" />
        <AdminMetric label="Pending" value={vrf?.pendingRequestExists ? "Yes" : "No"} detail="Coordinator pending request state" tone={vrf?.pendingRequestExists ? "pending" : "win"} />
      </div>

      <section className="mt-4 panel p-4">
        <div className="mb-4 flex flex-col gap-3 border-b border-[var(--border)] pb-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">
              <RadioTower size={14} className="text-[var(--accent)]" />
              Subscription health
            </div>
            <h2 className="mt-2 display-heading text-xl font-bold text-[var(--text-1)]">Shared VRF source</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-2)]">
              The same VRF subscription powers game settlement and Lucky Draw requests, so low native balance or pending coordinator issues can affect both surfaces.
            </p>
          </div>
          <button type="button" onClick={() => void ops.refetch()} className="play-button-ghost inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-bold">
            <RefreshCw size={14} className={ops.isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-5 text-[var(--text-2)]">
            <div>Sub ID: <span className="font-mono text-[var(--text-1)]">{vrf?.subscriptionId ?? "-"}</span></div>
            <div>Coordinator: <span className="font-mono text-[var(--text-1)]">{vrf?.coordinator ? shortenAddress(vrf.coordinator, 6) : "-"}</span></div>
            <div>Owner: <span className="font-mono text-[var(--text-1)]">{vrf?.owner ? shortenAddress(vrf.owner, 6) : "-"}</span></div>
            <div>Consumers: <span className="font-mono text-[var(--text-1)]">{vrf?.consumers.length ?? 0}</span></div>
            <div>LuckyDraw consumer: <span className={vrf?.luckyDrawConsumerReady ? "text-[var(--win)]" : "text-[var(--lose)]"}>{vrf?.luckyDrawConsumerReady ? "Ready" : "Missing"}</span></div>
          </div>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <OpsMetric label="Native" value={`${vrf?.nativeBalanceEth ?? "-"} ETH`} detail={formatEthUsd(vrf?.nativeBalanceEth)} />
              <OpsMetric label="LINK" value={`${vrf?.linkBalance ?? "-"} LINK`} detail="No USD value" />
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input value={fundEth} onChange={(event) => setFundEth(event.target.value)} className="admin-table-input h-10" aria-label="VRF native funding amount" />
              <button type="button" onClick={() => void fundVrfNative()} disabled={!vrf || isPending} className="primary-action inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-white disabled:opacity-45">
                {isPending && <Loader2 size={15} className="animate-spin" />}
                Fund VRF native
              </button>
            </div>
            <a href="https://vrf.chain.link/base" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-[var(--accent)]">
              Open Chainlink VRF panel <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </section>

      <section className="mt-4 admin-note">
        <div className="flex items-start gap-3">
          <ShieldCheck size={17} className="mt-1 text-[var(--accent)]" />
          <p className="text-sm leading-6 text-[var(--text-2)]">
            Game rounds and Lucky Draw requests still validate on their own contracts. This page only centralizes the shared randomness subscription funding and consumer health.
          </p>
        </div>
      </section>
    </AdminShell>
  );
}

function OpsMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="lucky-draw-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className="mt-1 block font-mono text-[10px] text-[var(--text-3)]">{detail}</small>
    </div>
  );
}

function formatEthUsd(value: string | number | undefined) {
  const ethValue = Number(value ?? 0);
  if (!Number.isFinite(ethValue) || ethValue <= 0) return "USD pending";
  return formatUsd(ethValue * ETH_USD_REFERENCE);
}
