"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import miniAppSdk from "@farcaster/miniapp-sdk";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi.config";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ReferralAttribution } from "@/components/referral/ReferralAttribution";
import { WalletConnectModal } from "@/components/wallet/WalletConnectModal";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            gcTime: 5 * 60_000
          }
        }
      })
  );

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
      <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <FarcasterMiniAppReady />
            <ReferralAttribution />
            <WalletConnectModal />
            {children}
          </ToastProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}

function FarcasterMiniAppReady() {
  useEffect(() => {
    let active = true;
    miniAppSdk
      .isInMiniApp()
      .then((isInMiniApp) => {
        if (active && isInMiniApp) return miniAppSdk.actions.ready();
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return null;
}
