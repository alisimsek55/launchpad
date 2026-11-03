"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WagmiProvider, createConfig, http, useAccount, useConnect, useDisconnect } from "wagmi";
import { mock } from "wagmi/connectors";
import { chain, isLocal } from "@/config";
import { WalletUIContext } from "./context";

/// SADECE YEREL: anvil'in kilidi açık test hesabı #1 (herkese açık test adresi).
/// İşlemler anvil'e eth_sendTransaction ile gider; özel anahtar gerekmez.
const ANVIL_TEST_ACCOUNT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const wagmiConfig = createConfig({
  chains: [chain],
  connectors: isLocal ? [mock({ accounts: [ANVIL_TEST_ACCOUNT], features: { reconnect: true } })] : [],
  transports: { [chain.id]: http() },
  ssr: true,
});

function DevWalletUI({ children }: { children: ReactNode }) {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const connector = connectors[0];
  return (
    <WalletUIContext.Provider
      value={{
        ready: true,
        connected: isConnected,
        connect: () => connector && connect({ connector }),
        disconnect: () => disconnect(),
        unavailableReason: connector ? undefined : "Cüzdan girişi için NEXT_PUBLIC_PRIVY_APP_ID gerekli",
      }}
    >
      {children}
    </WalletUIContext.Provider>
  );
}

export function DevProviders({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <DevWalletUI>{children}</DevWalletUI>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
