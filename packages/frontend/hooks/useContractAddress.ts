"use client";

import { getContractAddress } from "@baseplay/shared/config/addresses";
import { useAccount } from "wagmi";
import { defaultChainId } from "@/lib/env";

export function useContractAddress(contractName: string): `0x${string}` | null {
  const { chain } = useAccount();
  const chainId = chain?.id ?? defaultChainId;

  try {
    return getContractAddress(chainId, contractName);
  } catch {
    return null;
  }
}
