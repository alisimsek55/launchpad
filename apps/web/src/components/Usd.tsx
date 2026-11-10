"use client";

import { USD_NOTE, useEthUsd } from "@/lib/ethUsd";
import { fmtEth, fmtUsd } from "@/lib/format";

/// ETH tutarının USD karşılığı ("≈ $1.23"). Fiyat yoksa hiçbir şey çizmez.
export function Usd({ eth, prefix = "≈ ", className }: { eth: number | undefined; prefix?: string; className?: string }) {
  const usd = useEthUsd();
  if (usd === undefined || eth === undefined || !Number.isFinite(eth)) return null;
  return (
    <span className={className} title={USD_NOTE}>
      {prefix}
      {fmtUsd(eth * usd)}
    </span>
  );
}

/// pump.fun gibi: USD birincil, ETH ikincil (küçük, soluk). Fiyat yoksa yalnızca ETH.
export function UsdFirst({ eth, digits = 4, secondaryClass = "text-xs font-normal text-muted" }: { eth: number; digits?: number; secondaryClass?: string }) {
  const usd = useEthUsd();
  const ethText = `${fmtEth(eth, digits)} ETH`;
  if (usd === undefined) return <>{ethText}</>;
  return (
    <span title={USD_NOTE}>
      {fmtUsd(eth * usd)} <span className={secondaryClass}>{ethText}</span>
    </span>
  );
}
