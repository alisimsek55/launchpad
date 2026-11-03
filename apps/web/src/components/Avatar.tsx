import { colorsFromAddress } from "@launchpad/shared";

/// Adresten deterministik gradyan avatar.
export function Avatar({ address, size = 20 }: { address: string; size?: number }) {
  const [a, b] = colorsFromAddress(address);
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${a}, ${b})` }}
    />
  );
}
