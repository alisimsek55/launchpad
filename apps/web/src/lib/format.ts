/// Görüntüleme yardımcıları. Tutarlar ETH cinsinden; USD karşılığı src/lib/ethUsd.ts + fmtUsd ile.

/// 1'in altındaki değerlerde anlamlı basamak (testnet'te tutarlar küçük: 0.0042 ETH gibi)
export function fmtEth(v: number, digits = 4): string {
  if (v === 0) return "0";
  if (Math.abs(v) < 1e-7) return v.toExponential(2);
  if (Math.abs(v) < 1) return v.toLocaleString("en-US", { maximumSignificantDigits: Math.max(digits, 3) });
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

/// USD: 100k ve üstü kısaltılmış ($123.4K), 1-100k arası 2 ondalık, 1'in altı 3 anlamlı
/// basamak, çok küçükler fmtPrice gibi alt simgeli ($0.0₈213). Testnet tutarları küçük olduğu için.
export function fmtUsd(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a === 0) return "$0";
  if (a >= 100_000) return `${sign}$${fmtCompact(a)}`;
  if (a >= 1) return `${sign}$${a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (a >= 0.001) return `${sign}$${a.toLocaleString("en-US", { maximumSignificantDigits: 3 })}`;
  return `${sign}$${fmtPrice(a)}`;
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
