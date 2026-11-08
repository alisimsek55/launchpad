"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore, type ReactNode } from "react";
import { WagmiProvider, createConfig, http, useAccount, useConnect, useDisconnect } from "wagmi";
import { injected, mock } from "wagmi/connectors";
import { chain, isLocal } from "@/config";
import { WalletUIContext } from "./context";

/// SADECE YEREL: anvil'in kilidi açık test hesabı #1 (herkese açık test adresi).
/// İşlemler anvil'e eth_sendTransaction ile gider; özel anahtar gerekmez.
const ANVIL_TEST_ACCOUNT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

/// Hesap gerektirmeyen cüzdan bağlantısı: tarayıcı eklentisi (MetaMask, Rabby...).
/// Yerelde ayrıca anvil test cüzdanı öncelikli bağlanır.
const wagmiConfig = createConfig({
  chains: [chain],
  connectors: isLocal
    ? [mock({ accounts: [ANVIL_TEST_ACCOUNT], features: { reconnect: true } }), injected()]
    : [injected()],
  // chain.id deploy dosyasına göre 4663 veya 46630; tek ağ yapılandırılır
  transports: { [chain.id]: http() } as Record<typeof chain.id, ReturnType<typeof http>>,
  ssr: true,
});

function BrowserWalletUI({ children }: { children: ReactNode }) {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  // window.ethereum sadece tarayıcıda okunabilir; sunucuda "var" kabul edilir (hydration uyumu)
  const hasExtension = useSyncExternalStore(
    () => () => {},
    () => "ethereum" in window,
    () => true,
  );

  const connector = connectors[0];
  const available = isLocal || hasExtension;
  return (
    <WalletUIContext.Provider
      value={{
        ready: true,
        connected: isConnected,
        connect: () => connector && connect({ connector, chainId: chain.id }),
        disconnect: () => disconnect(),
        unavailableReason: available ? undefined : "Tarayıcı cüzdanı bulunamadı: MetaMask veya Rabby kur",
      }}
    >
      {children}
    </WalletUIContext.Provider>
  );
}

export function BrowserWalletProviders({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserWalletUI>{children}</BrowserWalletUI>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
