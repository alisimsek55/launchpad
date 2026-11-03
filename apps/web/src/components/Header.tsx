"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { isLocal } from "@/config";
import { useWalletUI } from "@/wallet/context";
import { Avatar } from "./Avatar";

export function Header() {
  const wallet = useWalletUI();
  const { address } = useAccount();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Launchpad
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted">
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
        <div className="ml-auto flex items-center gap-3">
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
