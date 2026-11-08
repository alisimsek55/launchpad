"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { http, useAccount } from "wagmi";
import { PRIVY_APP_ID, chain } from "@/config";
import { WalletUIContext } from "./context";

const wagmiConfig = createConfig({
  chains: [chain],
  // chain.id deploy dosyasına göre 4663 veya 46630; tek ağ yapılandırılır
  transports: { [chain.id]: http() } as Record<typeof chain.id, ReturnType<typeof http>>,
});

function PrivyWalletUI({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { isConnected } = useAccount();
  return (
    <WalletUIContext.Provider
      value={{ ready, connected: authenticated && isConnected, connect: login, disconnect: logout }}
    >
      {children}
    </WalletUIContext.Provider>
  );
}

export function PrivyProviders({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        defaultChain: chain,
        supportedChains: [chain],
        appearance: { theme: "dark", accentColor: "#00C805" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <PrivyWalletUI>{children}</PrivyWalletUI>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
