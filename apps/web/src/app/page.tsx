import { GRADUATION_ETH, robinhood } from "@launchpad/shared";
import { formatEther } from "viem";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-black p-16 text-zinc-50">
      <h1 className="text-4xl font-semibold tracking-tight">Launchpad</h1>
      <p className="text-zinc-400">
        {robinhood.name} (chain {robinhood.id}) · graduation {formatEther(GRADUATION_ETH)} ETH
      </p>
    </main>
  );
}
