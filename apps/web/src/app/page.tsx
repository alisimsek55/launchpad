import { TokenList } from "@/components/TokenList";
import { GRADUATION_ETH, isTestnet } from "@/config";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Tokens</h1>
        <p className="mt-1 text-sm text-muted">
          Bonding curve ile başlar, {GRADUATION_ETH} ETH&apos;de Uniswap v3&apos;e geçer. Likidite sonsuza kadar kilitli.
          {isTestnet && " Robinhood testnet demosu: test ETH'si faucet'ten ücretsiz."}
        </p>
      </div>
      <TokenList />
    </div>
  );
}
