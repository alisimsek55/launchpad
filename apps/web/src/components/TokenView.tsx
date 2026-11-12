"use client";

import { nameFromAddress } from "@launchpad/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { chain, INDEXER_URL_MISSING } from "@/config";
import { useMetadata, useToken, useHolders } from "@/data/hooks";
import { fmtEth, fmtPrice, shortAddr } from "@/lib/format";
import { Avatar } from "./Avatar";
import { GraduationBar } from "./GraduationBar";
import { useGraduationPending } from "./PendingGraduation";
import { PriceChart } from "./PriceChart";
import { TokenImage } from "./TokenImage";
import { TokenTabs } from "./TokenTabs";
import { TradePanel } from "./TradePanel";
import { Usd, UsdFirst } from "./Usd";

export function TokenView() {
  const params = useParams<{ address: string }>();
  if (!isAddress(params.address)) return <p className="text-muted">Geçersiz adres.</p>;
  return <TokenViewInner token={getAddress(params.address)} />;
}

function TokenViewInner({ token }: { token: Address }) {
  const { data: t, isLoading, isError, isFetching, refetch } = useToken(token);
  const { data: meta } = useMetadata(t?.metadataURI);
  const { data: holders } = useHolders(token);
  // Token yüklenene kadar zincir okuması kapalı (graduated: true okuma yapmaz)
  const pending = useGraduationPending(token, t ?? { graduated: true });
  if (isLoading) return <p className="text-muted">Yükleniyor…</p>;
  // Indexer 404 değil `null` döner (bulunamadı); hata ise ulaşılamadı demektir, ikisi ayrı gösterilir.
  // Önceden yüklenmiş veri varken arka plan yenilemesi hata verirse sayfa olduğu gibi kalır.
  if (!t && isError)
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted">
          {INDEXER_URL_MISSING
            ? "Indexer adresi yapılandırılmamış (NEXT_PUBLIC_INDEXER_URL)."
            : "Indexer'a ulaşılamadı; token bilgisi şu an yüklenemiyor."}
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg border border-line px-3 py-1 hover:bg-surface-2 disabled:opacity-50"
        >
          {isFetching ? "Deneniyor…" : "Tekrar dene"}
        </button>
      </div>
    );
  if (!t) return <p className="text-muted">Token bulunamadı.</p>;

  const explorer = chain.blockExplorers?.default.url;
  const usdBelow = "block text-xs font-normal text-muted";
  const stats: { label: string; value: ReactNode }[] = [
    { label: "Market cap", value: <UsdFirst eth={t.marketCapEth} digits={2} secondaryClass={usdBelow} /> },
    { label: "Holders", value: holders ? String(holders.holderCount) : "–" },
    { label: "Trades", value: String(t.tradeCount) },
    { label: "Supply", value: "1B" },
    {
      label: "Creator earned",
      value: (
        <>
          {fmtEth(t.creatorFeesEth)} ETH
          <Usd eth={t.creatorFeesEth} className={usdBelow} />
        </>
      ),
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-4">
        <div className="flex items-start gap-4">
          <TokenImage address={t.address} metadataURI={t.metadataURI} symbol={t.symbol} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold">
              {t.name} <span className="text-muted">${t.symbol}</span>
            </h1>
            <Link href={`/profile/${t.creator}`} className="mt-1 flex items-center gap-2 text-sm text-muted hover:underline">
              <Avatar address={t.creator} size={16} /> {nameFromAddress(t.creator)}
            </Link>
            {meta?.description && <p className="mt-2 text-sm">{meta.description}</p>}
            <div className="mt-2 flex gap-3 text-xs text-muted">
              {meta?.x && <a href={meta.x} target="_blank" rel="noreferrer" className="hover:text-foreground">X</a>}
              {meta?.telegram && <a href={meta.telegram} target="_blank" rel="noreferrer" className="hover:text-foreground">Telegram</a>}
              {meta?.website && <a href={meta.website} target="_blank" rel="noreferrer" className="hover:text-foreground">Website</a>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold">{fmtPrice(t.priceEth)} ETH</div>
            <div className="text-xs text-muted">
              token başına
              <Usd eth={t.priceEth} prefix=" · " />
            </div>
          </div>
        </div>

        <PriceChart token={token} />

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-xs text-muted">{s.label}</div>
              <div className="font-semibold">{s.value}</div>
            </div>
          ))}
          <div className="col-span-2 sm:col-span-5">
            <GraduationBar realEth={t.realEth} graduated={t.graduated} pending={pending} />
          </div>
          <div className="col-span-2 flex gap-6 text-xs text-muted sm:col-span-5">
            <span>
              Token{" "}
              <a href={`${explorer}/address/${t.address}`} target="_blank" rel="noreferrer" className="text-foreground hover:underline">
                {shortAddr(t.address)}
              </a>
            </span>
            <span>
              Pool{" "}
              <a href={`${explorer}/address/${t.pool}`} target="_blank" rel="noreferrer" className="text-foreground hover:underline">
                {shortAddr(t.pool)}
              </a>
            </span>
            <span>Launched {new Date(t.createdAt * 1000).toLocaleString()}</span>
          </div>
        </div>

        <TokenTabs token={token} symbol={t.symbol} />
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <TradePanel token={token} symbol={t.symbol} graduated={t.graduated} pending={pending} />
      </div>
    </div>
  );
}
