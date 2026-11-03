/// Görüntüleme yardımcıları. Fiyatlar ETH cinsinden (USD fiyat beslemesi faz 2.0).

export function fmtEth(v: number, digits = 4): string {
  if (v === 0) return "0";
  if (Math.abs(v) < 1e-4) return v.toExponential(2);
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/// Çok küçük fiyatlar: 0.0000000013 → "0.0₈13" (sıfır sayısı alt simge)
export function fmtPrice(v: number): string {
  if (v === 0) return "0";
  if (v >= 0.001) return v.toLocaleString("en-US", { maximumSignificantDigits: 4 });
  const s = v.toFixed(20);
  const zeros = s.slice(2).search(/[1-9]/);
  const sig = s.slice(2 + zeros, 2 + zeros + 4).replace(/0+$/, "");
  const sub = String(zeros)
    .split("")
    .map((d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)])
    .join("");
  return `0.0${sub}${sig}`;
}

export function fmtCompact(v: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(v);
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function timeAgo(unix: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - unix);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
