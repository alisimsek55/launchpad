"use client";

import { nameFromAddress } from "@launchpad/shared";
import Link from "next/link";
import { useState } from "react";
import { useTokens } from "@/data/hooks";
import type { TokenSort } from "@/data/types";
import { timeAgo } from "@/lib/format";
import { GraduationBar } from "./GraduationBar";
import { TokenImage } from "./TokenImage";
import { UsdFirst } from "./Usd";

const SORTS: { key: TokenSort; label: string }[] = [
  { key: "new", label: "New" },
  { key: "marketCap", label: "Market cap" },
  { key: "volume", label: "Volume" },
];

export function TokenList() {
  const [sort, setSort] = useState<TokenSort>("new");
  const { data, isLoading, error } = useTokens(sort);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`rounded-full px-3 py-1 text-sm ${sort === s.key ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-danger">Veri alınamadı: {(error as Error).message}</p>}
      {isLoading && <p className="text-sm text-muted">Yükleniyor…</p>}
      {data && data.length === 0 && <p className="text-sm text-muted">Henüz token yok. İlkini sen oluştur.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((t) => (
          <Link
            key={t.address}
            href={`/token/${t.address}`}
            className="space-y-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-muted"
          >
            <div className="flex items-center gap-3">
              <TokenImage address={t.address} metadataURI={t.metadataURI} symbol={t.symbol} />
              <div className="min-w-0">
                <div className="truncate font-semibold">{t.name}</div>
                <div className="text-xs text-muted">
                  ${t.symbol} · {nameFromAddress(t.creator)} · {timeAgo(t.createdAt)}
                </div>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Market cap</span>
              <span className="font-medium">
                <UsdFirst eth={t.marketCapEth} digits={2} />
              </span>
            </div>
            <GraduationBar realEth={t.realEth} graduated={t.graduated} />
          </Link>
        ))}
      </div>
    </div>
  );
}
