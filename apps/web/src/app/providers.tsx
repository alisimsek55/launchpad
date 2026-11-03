"use client";

import { QueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { PRIVY_APP_ID } from "@/config";
import { DevProviders } from "@/wallet/DevProviders";
import { PrivyProviders } from "@/wallet/PrivyProviders";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 3_000, refetchOnWindowFocus: false } } }),
  );
  // Privy app ID varsa gerçek giriş; yoksa (yerel geliştirme) anvil test cüzdanı.
  return PRIVY_APP_ID ? (
    <PrivyProviders queryClient={queryClient}>{children}</PrivyProviders>
  ) : (
    <DevProviders queryClient={queryClient}>{children}</DevProviders>
  );
}
