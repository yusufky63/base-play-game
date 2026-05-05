"use client";

import { useAccount } from "wagmi";
import { env } from "@/lib/env";

const EXTRA_ADMIN_ADDRESSES = ["0xEAa823AB4C4eE00283d8ed7be713ddf8A5ba0Fac"];

export function useIsOwner() {
  const { address, isConnected } = useAccount();
  const owner = env.NEXT_PUBLIC_OWNER_ADDRESS;
  const allowedAddresses = [owner, ...EXTRA_ADMIN_ADDRESSES]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  return Boolean(isConnected && address && allowedAddresses.includes(address.toLowerCase()));
}
