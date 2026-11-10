"use client";

import { ColorType, HistogramSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDays, useProtocol, useTokens, useTopTokens } from "@/data/hooks";
import type { DayStat } from "@/data/types";
import { fmtCompact, fmtEth } from "@/lib/format";
import { TokenImage } from "./TokenImage";
import { Usd } from "./Usd";

const RANGES = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "All", days: 0 },
] as const;

const METRICS: { key: keyof Omit<DayStat, "date">; label: string; eth: boolean }[] = [
  { key: "volumeEth", label: "Volume", eth: true },
  { key: "launches", label: "Launches", eth: false },
  { key: "feesEth", label: "Fees", eth: true },
  { key: "protocolRevenueEth", label: "Revenue", eth: true },
  { key: "graduations", label: "Graduations", eth: false },
  { key: "tradeCount", label: "Trades", eth: false },
];

export function Analytics() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[1]);
  const [metric, setMetric] = useState(METRICS[0]!);
  // Sabit "şimdi": sorgu anahtarı her render'da değişmesin
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const since = range.days === 0 ? 0 : now - range.days * 86400;

  const protocol = useProtocol();
  const days = useDays(since);
  const allDays = useDays(now - 56 * 86400); // grafik: son 8 hafta
  const top = useTopTokens(now - 30 * 86400);
  const tokens = useTokens("new", 500);
  const tokenByAddr = new Map(tokens.data?.map((t) => [t.address.toLowerCase(), t]));

  const summary = useMemo(() => {
    if (range.days === 0 && protocol.data)
      return {
        volume: protocol.data.volumeEth,
        launches: protocol.data.tokenCount,
        fees: protocol.data.feesEth,
        revenue: protocol.data.protocolRevenueEth,
        trades: protocol.data.tradeCount,
      };
    const ds = (days.data ?? []).filter((d) => d.date + 86400 > since);
    return {
      volume: ds.reduce((s, d) => s + d.volumeEth, 0),
      launches: ds.reduce((s, d) => s + d.launches, 0),
      fees: ds.reduce((s, d) => s + d.feesEth, 0),
      revenue: ds.reduce((s, d) => s + d.protocolRevenueEth, 0),
      trades: ds.reduce((s, d) => s + d.tradeCount, 0),
    };
  }, [range, protocol.data, days.data, since]);

  const stats: { label: string; value: string; eth?: number }[] = [
    { label: "Volume", value: `${fmtEth(summary.volume, 3)} ETH`, eth: summary.volume },
    { label: "Launches", value: fmtCompact(summary.launches) },
    { label: "Fees", value: `${fmtEth(summary.fees, 4)} ETH`, eth: summary.fees },
    { label: "Protocol revenue", value: `${fmtEth(summary.revenue, 4)} ETH`, eth: summary.revenue },
  ];
  const chartTotal = (allDays.data ?? []).reduce((s, d) => s + d[metric.key], 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">Analytics</h1>
        <div className="flex rounded-full bg-surface p-1 text-sm">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 ${range.label === r.label ? "bg-surface-2 text-foreground" : "text-muted"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-background p-4">
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-muted">
              {s.label}
              {s.eth !== undefined && <Usd eth={s.eth} prefix=" · ≈ " />}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">
              {metric.eth ? `${fmtEth(chartTotal, 3)} ETH` : fmtCompact(chartTotal)}
            </div>
            <div className="text-xs text-muted">
              {metric.label}, son 56 gün
              {metric.eth && <Usd eth={chartTotal} prefix=" · ≈ " />}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 rounded-full bg-surface-2 p-1 text-xs">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m)}
                className={`rounded-full px-2.5 py-1 ${metric.key === m.key ? "bg-background text-foreground" : "text-muted"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <DailyBars data={allDays.data ?? []} metric={metric.key} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-3 font-semibold">Trading, {range.label}</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xl font-semibold">{fmtCompact(summary.trades)}</div>
              <div className="text-xs text-muted">Trades</div>
            </div>
            <div>
              <div className="text-xl font-semibold">{fmtCompact(summary.launches)}</div>
              <div className="text-xs text-muted">Launches</div>
            </div>
            <div>
              <div className="text-xl font-semibold">{summary.trades ? fmtEth(summary.volume / summary.trades, 4) : "0"} ETH</div>
              <div className="text-xs text-muted">
                Average trade
                {summary.trades > 0 && <Usd eth={summary.volume / summary.trades} prefix=" · ≈ " />}
              </div>
            </div>
          </div>
          {protocol.data && (
            <p className="mt-4 text-xs text-muted">
              Toplam {protocol.data.tokenCount} token · {protocol.data.graduatedCount} graduated
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-3 font-semibold">Top coins, son 30 gün</h2>
          {!top.data?.length && <p className="text-sm text-muted">Henüz işlem yok.</p>}
          <table className="w-full text-sm">
            <tbody>
              {top.data?.map((v, i) => {
                const t = tokenByAddr.get(v.token.toLowerCase());
                return (
                  <tr key={v.token} className="border-t border-line first:border-0">
                    <td className="w-6 py-2 text-muted">{i + 1}</td>
                    <td>
                      <Link href={`/token/${v.token}`} className="flex items-center gap-2 hover:underline">
                        {t && <TokenImage address={t.address} metadataURI={t.metadataURI} symbol={t.symbol} size={24} />}
                        {t?.name ?? v.token.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="text-right">
                      {fmtEth(v.volumeEth, 3)} ETH
                      <Usd eth={v.volumeEth} prefix="" className="block text-xs text-muted" />
                    </td>
                    <td className="text-right text-muted">{fmtCompact(v.tradeCount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DailyBars({ data, metric }: { data: DayStat[]; metric: keyof Omit<DayStat, "date"> }) {
  const container = useRef<HTMLDivElement>(null);
  const series = useRef<ISeriesApi<"Histogram"> | null>(null);
  const chart = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const c = createChart(container.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8b8b93" },
      grid: { vertLines: { visible: false }, horzLines: { color: "#1f1f22" } },
      rightPriceScale: { borderColor: "#2a2a2e" },
      timeScale: { borderColor: "#2a2a2e" },
    });
    series.current = c.addSeries(HistogramSeries, { color: "#d4d4d8" });
    chart.current = c;
    return () => c.remove();
  }, []);

  useEffect(() => {
    if (!series.current) return;
    const today = Math.floor(Date.now() / 86400000) * 86400;
    series.current.setData(
      data.map((d) => ({
        time: d.date as UTCTimestamp,
        value: d[metric],
        color: d.date === today ? "#00c805" : "#d4d4d8",
      })),
    );
    chart.current?.timeScale().fitContent();
  }, [data, metric]);

  return <div ref={container} className="h-72 w-full" />;
}
