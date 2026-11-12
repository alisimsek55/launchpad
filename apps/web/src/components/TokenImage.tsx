"use client";

import { colorsFromAddress } from "@launchpad/shared";
import { useMetadata } from "@/data/hooks";

/// Metadata'daki görsel; yoksa adresten gradyan + sembolün baş harfi.
export function TokenImage({
  address,
  metadataURI,
  symbol,
  size = 48,
}: {
  address: string;
  metadataURI?: string;
  symbol: string;
  size?: number;
}) {
  const { data } = useMetadata(metadataURI);
  const [a, b] = colorsFromAddress(address);
  if (data?.image) {
    // Görsel yalnızca zincir üstü data:image (metadata.ts doğrular); harici istek yapılmaz
    return (
      // eslint-disable-next-line @next/next/no-img-element -- kullanıcı görselleri zincir üstü data: URI
      <img
        src={data.image}
        alt={symbol}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        className="shrink-0 rounded-xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl font-semibold text-black/70"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${a}, ${b})`, fontSize: size / 2.4 }}
    >
      {symbol.slice(0, 1)}
    </span>
  );
}
