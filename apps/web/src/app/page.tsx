import { TokenList } from "@/components/TokenList";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Tokens</h1>
        <p className="mt-1 text-sm text-muted">
          Bonding curve ile başlar, 4.2 ETH&apos;de Uniswap v3&apos;e geçer. Likidite sonsuza kadar kilitli.
        </p>
      </div>
      <TokenList />
    </div>
  );
}
