"use client";

import { ExternalLink } from "lucide-react";
import { useAccount } from "wagmi";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { getGame } from "@baseplay/shared/config/games.registry";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";
import { defaultChainId } from "@/lib/env";
import { shortenAddress } from "@/lib/formatters";

export function GameContractPanel({ gameId }: { gameId: string }) {
  const { chain } = useAccount();
  const connectedChainId = chain?.id ?? defaultChainId;
  const chainId = getNetworkByChainId(connectedChainId) ? connectedChainId : defaultChainId;
  const game = getGame(gameId);
  const network = getNetworkByChainId(chainId);
  const gameAddress = game ? CONTRACT_ADDRESSES[chainId]?.[game.contractName] : undefined;
  const vaultAddress = CONTRACT_ADDRESSES[chainId]?.GameVault;

  if (!game || !network || !gameAddress) return null;

  return (
    <section className="contract-panel" aria-label="Public contract addresses">
      <div>
        <div className="font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">Contracts on {network.name}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <ContractLink label={game.name} address={gameAddress} explorer={network.blockExplorer} />
          {vaultAddress && <ContractLink label="Vault" address={vaultAddress} explorer={network.blockExplorer} />}
        </div>
      </div>
    </section>
  );
}

function ContractLink({ label, address, explorer }: { label: string; address: string; explorer: string }) {
  return (
    <a
      href={`${explorer}/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="contract-link"
      title={`${label} contract on explorer`}
    >
      <span>{label}</span>
      <strong>{shortenAddress(address, 5)}</strong>
      <ExternalLink size={12} />
    </a>
  );
}
