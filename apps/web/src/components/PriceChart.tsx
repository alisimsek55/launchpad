"use client";

import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { useCandles } from "@/data/hooks";
import { CANDLE_INTERVALS } from "@/data/types";
import { fmtPrice } from "@/lib/format";

/// TradingView Lightweight Charts ile OHLC + hacim.
export function PriceChart({ token }: { token: Address }) {
  const [interval, setInterval] = useState<number>(300);
  const { data } = useCandles(token, interval);
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volume = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const c = createChart(container.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8b8b93" },
      grid: { vertLines: { color: "#1f1f22" }, horzLines: { color: "#1f1f22" } },
      rightPriceScale: { borderColor: "#2a2a2e" },
      timeScale: { borderColor: "#2a2a2e", timeVisible: true },
      localization: { priceFormatter: fmtPrice },
    });
    candles.current = c.addSeries(CandlestickSeries, {
      upColor: "#00c805",
      downColor: "#ff5a36",
      wickUpColor: "#00c805",
      wickDownColor: "#ff5a36",
      borderVisible: false,
      priceFormat: { type: "custom", formatter: fmtPrice, minMove: 1e-15 },
    });
    volume.current = c.addSeries(HistogramSeries, { priceScaleId: "", priceFormat: { type: "volume" } });
    volume.current.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    chart.current = c;
    return () => c.remove();
  }, []);

  useEffect(() => {
    if (!data || !candles.current || !volume.current) return;
    candles.current.setData(
      data.map((d) => ({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close })),
    );
    volume.current.setData(
      data.map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.volumeEth,
        color: d.close >= d.open ? "rgba(0,200,5,0.35)" : "rgba(255,90,54,0.35)",
      })),
    );
  }, [data]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex justify-end gap-1">
        {CANDLE_INTERVALS.map((i) => (
          <button
            key={i.seconds}
            onClick={() => setInterval(i.seconds)}
            className={`rounded-full px-2.5 py-0.5 text-xs ${interval === i.seconds ? "bg-surface-2 text-foreground" : "text-muted"}`}
          >
            {i.label}
          </button>
        ))}
      </div>
      <div ref={container} className="h-80 w-full" />
      {data?.length === 0 && <p className="text-center text-xs text-muted">Henüz işlem yok</p>}
    </div>
  );
}
