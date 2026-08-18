"use client";

import { useAccount } from "wagmi";
import { env } from "@/lib/env";

const parseAdminAddresses = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export function useIsOwner() {
  const { address, isConnected } = useAccount();
  const owner = env.NEXT_PUBLIC_OWNER_ADDRESS;
  const adminAddresses = parseAdminAddresses(env.NEXT_PUBLIC_ADMIN_ADDRESSES);
  const allowedAddresses = [owner, ...adminAddresses]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  return Boolean(isConnected && address && allowedAddresses.includes(address.toLowerCase()));
}
