"use client";

import { getContractAddress } from "@baseplay/shared/config/addresses";
import { baseSepolia } from "wagmi/chains";
import { useAccount } from "wagmi";

export function useContractAddress(contractName: string): `0x${string}` | null {
  const { chain } = useAccount();
  const chainId = chain?.id ?? baseSepolia.id;

  try {
    return getContractAddress(chainId, contractName);
  } catch {
    return null;
  }
}
