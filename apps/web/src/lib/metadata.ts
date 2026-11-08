/// Zincir üstü token metadata'sı: görsel tarayıcıda küçültülüp sıkıştırılır, JSON ile birlikte
/// `data:application/json;base64,...` olarak TokenFactory'ye `metadataURI` diye yazılır.
/// Sunucu veya dosya deposu gerekmez.

export const IMAGE_SIZE = 128; // px, kare
export const MAX_METADATA_BYTES = 24_000; // gas'ı sınırlı tutmak için üst sınır

export type TokenMetadataInput = {
  name: string;
  symbol: string;
  description: string;
  x: string;
  telegram: string;
  website: string;
};

/// Görseli ortadan kare kırpar, 128x128 WebP'ye (desteklenmiyorsa JPEG) sıkıştırır.
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_SIZE;
  canvas.height = IMAGE_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    IMAGE_SIZE,
    IMAGE_SIZE,
  );
  for (const quality of [0.8, 0.6, 0.4]) {
    const webp = canvas.toDataURL("image/webp", quality);
    const url = webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
    if (url.length < MAX_METADATA_BYTES - 2_000) return url;
  }
  throw new Error("Görsel sıkıştırılamadı, daha basit bir görsel dene");
}

/// "@handle" / "handle" / URL → https://x.com/handle
function normalizeX(v: string): string | undefined {
  const s = v.trim();
  if (!s) return undefined;
  if (/^https:\/\/(x|twitter)\.com\//i.test(s)) return s;
  const handle = s.replace(/^@/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? `https://x.com/${handle}` : undefined;
}

/// "username" / "t.me/username" / URL → https://t.me/username
function normalizeTelegram(v: string): string | undefined {
  const s = v.trim().replace(/^@/, "");
  if (!s) return undefined;
  const m = s.match(/^(?:https:\/\/)?t\.me\/([A-Za-z0-9_+/]+)$/i);
  if (m) return `https://t.me/${m[1]}`;
  return /^[A-Za-z0-9_]{4,32}$/.test(s) ? `https://t.me/${s}` : undefined;
}

export function buildMetadataURI(input: TokenMetadataInput, image: string): string {
  const json = JSON.stringify({
    name: input.name.trim(),
    symbol: input.symbol.trim().toUpperCase(),
    description: input.description.trim(),
    image,
    x: normalizeX(input.x),
    telegram: normalizeTelegram(input.telegram),
    website: input.website.trim() || undefined,
  });
  const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  const uri = `data:application/json;base64,${base64}`;
  if (uri.length > MAX_METADATA_BYTES) throw new Error("Metadata çok büyük; açıklamayı kısalt");
  return uri;
}
