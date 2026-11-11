"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { isLocal } from "@/config";
import { USD_NOTE, useEthUsd } from "@/lib/ethUsd";
import { fmtUsd } from "@/lib/format";
import { useWalletUI } from "@/wallet/context";
import { Avatar } from "./Avatar";

export function Header() {
  const wallet = useWalletUI();
  const { address } = useAccount();
  const ethUsd = useEthUsd();

  return (
    <header className="border-b border-line">
      {/* Mobilde (<sm) nav ikinci satıra iner (logo + cüzdan üstte); sm ve üstü tek satır, eskisi gibi */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:h-16 sm:flex-nowrap sm:py-0">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Launchpad
        </Link>
        <nav className="order-last flex w-full items-center gap-4 overflow-x-auto whitespace-nowrap text-sm text-muted sm:order-none sm:w-auto sm:gap-5 sm:overflow-visible">
          <Link href="/create" className="hover:text-foreground">
            + Create a token
          </Link>
          <Link href="/analytics" className="hover:text-foreground">
            Analytics
          </Link>
          <Link href="/docs" className="hover:text-foreground">
            Docs
          </Link>
          {address && (
            <Link href={`/profile/${address}`} className="hover:text-foreground">
              Profile
            </Link>
          )}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {ethUsd !== undefined && (
            <span className="hidden text-xs text-muted sm:inline" title={USD_NOTE}>
              ETH {fmtUsd(ethUsd)}
            </span>
          )}
          {isLocal && (
            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">local anvil</span>
          )}
          {wallet.connected && address ? (
            <button
              onClick={wallet.disconnect}
              className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-sm hover:bg-line"
              title="Bağlantıyı kes"
            >
              <Avatar address={address} size={24} />
              {address.slice(0, 6)}…{address.slice(-4)}
            </button>
          ) : (
            <button
              onClick={wallet.connect}
              disabled={!wallet.ready || !!wallet.unavailableReason}
              title={wallet.unavailableReason}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-black hover:bg-accent-strong disabled:opacity-40"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
