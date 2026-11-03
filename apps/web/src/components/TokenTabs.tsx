"use client";

import { nameFromAddress } from "@launchpad/shared";
import Link from "next/link";
import { useState } from "react";
import { formatEther, type Address } from "viem";
import { useHolders, useTrades } from "@/data/hooks";
import { fmtCompact, fmtEth, fmtPrice, timeAgo } from "@/lib/format";
import { Avatar } from "./Avatar";

export function TokenTabs({ token, symbol }: { token: Address; symbol: string }) {
  const [tab, setTab] = useState<"trades" | "holders">("trades");
  const holders = useHolders(token);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex gap-4 border-b border-line text-sm">
        {(["trades", "holders"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-2 capitalize ${tab === t ? "border-foreground" : "border-transparent text-muted"}`}
          >
            {t}
            {t === "holders" && holders.data ? ` (${holders.data.holderCount})` : ""}
          </button>
        ))}
      </div>
      {tab === "trades" ? <Trades token={token} symbol={symbol} /> : <Holders data={holders.data} symbol={symbol} />}
    </div>
  );
}

function Trader({ address }: { address: Address }) {
  return (
    <Link href={`/profile/${address}`} className="flex items-center gap-2 hover:underline">
      <Avatar address={address} size={18} />
      {nameFromAddress(address)}
    </Link>
  );
}

function Trades({ token, symbol }: { token: Address; symbol: string }) {
  const { data } = useTrades(token);
  if (!data?.length) return <p className="py-6 text-center text-sm text-muted">Henüz işlem yok</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-muted">
        <tr>
          <th className="py-2 font-normal">Side</th>
          <th className="font-normal">Trader</th>
          <th className="text-right font-normal">ETH</th>
          <th className="text-right font-normal">{symbol}</th>
          <th className="text-right font-normal">Price</th>
          <th className="text-right font-normal">Age</th>
        </tr>
      </thead>
      <tbody>
        {data.map((t) => (
          <tr key={t.id} className="border-t border-line">
            <td className={`py-2 ${t.isBuy ? "text-accent" : "text-danger"}`}>{t.isBuy ? "↗ Buy" : "↘ Sell"}</td>
            <td>
              <Trader address={t.trader} />
            </td>
            <td className="text-right">{fmtEth(t.ethAmount)}</td>
            <td className="text-right">{fmtCompact(t.tokenAmount)}</td>
            <td className="text-right">{fmtPrice(t.priceEth)}</td>
            <td className="text-right text-muted">{timeAgo(t.timestamp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Holders({
  data,
  symbol,
}: {
  data: ReturnType<typeof useHolders>["data"];
  symbol: string;
}) {
  if (!data?.holders.length)
    return <p className="py-6 text-center text-sm text-muted">Holder verisi yok (indexer çalışıyor mu?)</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-muted">
        <tr>
          <th className="py-2 font-normal">#</th>
          <th className="font-normal">Holder</th>
          <th className="font-normal">Type</th>
          <th className="text-right font-normal">Share</th>
          <th className="text-right font-normal">{symbol}</th>
        </tr>
      </thead>
      <tbody>
        {data.holders.map((h) => (
          <tr key={h.holder} className="border-t border-line">
            <td className="py-2 text-muted">{h.rank}</td>
            <td>
              <div className="flex items-center gap-2">
                <Trader address={h.holder} />
                {h.label && <span className="rounded-full bg-surface-2 px-2 text-xs text-muted">{h.label}</span>}
              </div>
            </td>
            <td className={h.type === "Contract" ? "font-semibold" : "text-muted"}>{h.type}</td>
            <td className="text-right">{h.sharePct.toFixed(2)}%</td>
            <td className="text-right">{fmtCompact(Number(formatEther(BigInt(h.balance))))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
