/// Token metadata doğrulama ve normalleştirme. Kurallar token oluşturma formuyla aynı.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type MetadataInput = {
  name: string;
  symbol: string;
  description: string;
  x: string;
  telegram: string;
  website: string;
};

export type TokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  x?: string;
  telegram?: string;
  website?: string;
};

const LINK = /(https?:\/\/|www\.)/i;

export function validate(input: MetadataInput): string | null {
  if (!input.name || input.name.length > 32) return "İsim 1-32 karakter olmalı";
  if (!input.symbol || input.symbol.length > 10) return "Ticker 1-10 karakter olmalı";
  if (input.description.length > 256) return "Açıklama en fazla 256 karakter";
  if (LINK.test(input.description)) return "Açıklamada link olamaz";
  if (input.website && !/^https:\/\/[^\s]+\.[^\s]+$/.test(input.website)) return "Website https:// ile başlamalı";
  if (input.x.length > 100 || input.telegram.length > 100) return "Sosyal link çok uzun";
  return null;
}

/// "@handle", "handle" veya tam URL → https://x.com/handle
export function normalizeX(v: string): string | undefined {
  const s = v.trim();
  if (!s) return undefined;
  if (/^https:\/\/(x|twitter)\.com\//i.test(s)) return s;
  const handle = s.replace(/^@/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? `https://x.com/${handle}` : undefined;
}

/// "username", "t.me/username" veya tam URL → https://t.me/username
export function normalizeTelegram(v: string): string | undefined {
  const s = v.trim().replace(/^@/, "");
  if (!s) return undefined;
  const m = s.match(/^(?:https:\/\/)?t\.me\/([A-Za-z0-9_+/]+)$/i);
  if (m) return `https://t.me/${m[1]}`;
  return /^[A-Za-z0-9_]{4,32}$/.test(s) ? `https://t.me/${s}` : undefined;
}
