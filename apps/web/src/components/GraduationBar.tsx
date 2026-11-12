"use client";

import { GRADUATION_ETH } from "@/config";
import { USD_NOTE, useEthUsd } from "@/lib/ethUsd";
import { fmtEth, fmtUsd } from "@/lib/format";

/// Curve'ün ne kadarının dolduğu (realEth / graduation eşiği). `pending`: curve kapandı, graduation sürüyor.
export function GraduationBar({ realEth, graduated, pending = false }: { realEth: number; graduated: boolean; pending?: boolean }) {
  const usd = useEthUsd();
  const done = graduated || pending;
  const pct = done ? 100 : Math.min(100, (realEth / GRADUATION_ETH) * 100);
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between gap-2 text-xs text-muted">
        <span>{graduated ? "Graduated · Uniswap v3" : pending ? "Graduation sürüyor" : `${pct.toFixed(1)}% · ${fmtEth(realEth)} / ${GRADUATION_ETH} ETH`}</span>
        {!done && usd !== undefined && (
          <span title={USD_NOTE}>
            ≈ {fmtUsd(realEth * usd)} / {fmtUsd(GRADUATION_ETH * usd)}
          </span>
        )}
      </div>
    </div>
  );
}
