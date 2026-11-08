"use client";

import { QueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { PRIVY_APP_ID } from "@/config";
import { BrowserWalletProviders } from "@/wallet/BrowserWalletProviders";
import { PrivyProviders } from "@/wallet/PrivyProviders";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 3_000, refetchOnWindowFocus: false } } }),
  );
  // Privy app ID varsa Privy (e-posta/sosyal giriş); yoksa hesapsız tarayıcı cüzdanı.
  return PRIVY_APP_ID ? (
    <PrivyProviders queryClient={queryClient}>{children}</PrivyProviders>
  ) : (
    <BrowserWalletProviders queryClient={queryClient}>{children}</BrowserWalletProviders>
  );
}
