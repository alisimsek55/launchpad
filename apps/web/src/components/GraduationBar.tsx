"use client";

import { GRADUATION_ETH } from "@/config";
import { USD_NOTE, useEthUsd } from "@/lib/ethUsd";
import { fmtEth, fmtUsd } from "@/lib/format";

/// Curve'ün ne kadarının dolduğu (realEth / graduation eşiği).
export function GraduationBar({ realEth, graduated }: { realEth: number; graduated: boolean }) {
  const usd = useEthUsd();
  const pct = graduated ? 100 : Math.min(100, (realEth / GRADUATION_ETH) * 100);
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between gap-2 text-xs text-muted">
        <span>{graduated ? "Graduated · Uniswap v3" : `${pct.toFixed(1)}% · ${fmtEth(realEth)} / ${GRADUATION_ETH} ETH`}</span>
        {!graduated && usd !== undefined && (
          <span title={USD_NOTE}>
            ≈ {fmtUsd(realEth * usd)} / {fmtUsd(GRADUATION_ETH * usd)}
          </span>
        )}
      </div>
    </div>
  );
}
