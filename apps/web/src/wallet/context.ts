"use client";

import { createContext, useContext } from "react";

/// Cüzdan arayüzü: Privy (production) ve yerel test cüzdanı (anvil) aynı arayüzü sunar.
export type WalletUI = {
  ready: boolean;
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  /// Bağlanamıyorsa nedeni (ör. Privy app ID eksik)
  unavailableReason?: string;
};

export const WalletUIContext = createContext<WalletUI>({
  ready: false,
  connected: false,
  connect: () => {},
  disconnect: () => {},
});

export const useWalletUI = () => useContext(WalletUIContext);
