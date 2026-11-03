/// DCA keeper: zamanı gelen planları DCAVault.execute ile çalıştırır.
///   LAUNCHPAD_NETWORK=local|mainnet   adresler packages/shared/deployments'tan
///   KEEPER_PRIVATE_KEY                keeper hesabı (DCAVault.setKeeper ile yetkilendirilmiş olmalı)
///   KEEPER_RPC_URL                    (isteğe bağlı) RPC
///   POLL_MS=30000  SLIPPAGE_BPS=300   döngü aralığı ve keeper'ın teklif üstüne uyguladığı slippage
/// `--once`: tek tur çalışıp çıkar (test için).
import { addresses, bondingCurveAbi, dcaVaultAbi, getDeployment, robinhood } from "@launchpad/shared";
import { createPublicClient, createWalletClient, defineChain, formatEther, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const deployment = getDeployment(process.env.LAUNCHPAD_NETWORK);
const chain = defineChain({
  ...robinhood,
  rpcUrls: { default: { http: [process.env.KEEPER_RPC_URL ?? deployment.rpcUrl] } },
});
const POLL_MS = Number(process.env.POLL_MS ?? 30_000);
const SLIPPAGE_BPS = BigInt(process.env.SLIPPAGE_BPS ?? 300);
const BACKOFF_MS = 10 * 60_000; // başarısız plan 10 dk dinlenir (ör. maxPrice aşıldı)

const key = process.env.KEEPER_PRIVATE_KEY as Hex | undefined;
if (!key) throw new Error("KEEPER_PRIVATE_KEY gerekli");
const account = privateKeyToAccount(key);
const publicClient = createPublicClient({ chain, transport: http() });
const wallet = createWalletClient({ chain, account, transport: http() });

const quoterAbi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160, uint32, uint256)",
]);
const UNI = addresses[4663];
const failedUntil = new Map<bigint, number>();
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

/// Güncel teklif (curve veya Uniswap) eksi slippage = minTokensOut
async function minOutFor(token: Hex, ethIn: bigint): Promise<bigint> {
  const curve = await publicClient.readContract({
    address: deployment.bondingCurve,
    abi: bondingCurveAbi,
    functionName: "curves",
    args: [token],
  });
  const graduated = curve[6];
  let quote: bigint;
  if (graduated) {
    const { result } = await publicClient.simulateContract({
      address: UNI.uniQuoterV2,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: UNI.weth, tokenOut: token, amountIn: ethIn, fee: 10_000, sqrtPriceLimitX96: 0n }],
    });
    quote = result[0];
  } else {
    [quote] = await publicClient.readContract({
      address: deployment.bondingCurve,
      abi: bondingCurveAbi,
      functionName: "quoteBuy",
      args: [token, ethIn],
    });
  }
  return (quote * (10_000n - SLIPPAGE_BPS)) / 10_000n;
}

async function tick() {
  const next = await publicClient.readContract({
    address: deployment.dcaVault,
    abi: dcaVaultAbi,
    functionName: "nextPlanId",
  });
  const ids = Array.from({ length: Number(next) - 1 }, (_, i) => BigInt(i + 1));
  if (ids.length === 0) return;

  const due = await publicClient.multicall({
    contracts: ids.map((id) => ({
      address: deployment.dcaVault,
      abi: dcaVaultAbi,
      functionName: "isDue" as const,
      args: [id] as const,
    })),
  });
  const now = Date.now();
  for (const [i, r] of due.entries()) {
    const id = ids[i]!;
    if (r.status !== "success" || !r.result) continue;
    if ((failedUntil.get(id) ?? 0) > now) continue;
    try {
      const plan = await publicClient.readContract({
        address: deployment.dcaVault,
        abi: dcaVaultAbi,
        functionName: "plans",
        args: [id],
      });
      const [, token, ethPerBuy, balance] = plan;
      const ethIn = balance < ethPerBuy ? balance : ethPerBuy;
      const minOut = await minOutFor(token, ethIn);
      const { request } = await publicClient.simulateContract({
        account,
        address: deployment.dcaVault,
        abi: dcaVaultAbi,
        functionName: "execute",
        args: [id, minOut],
      });
      const gas = await publicClient.estimateContractGas(request);
      const hash = await wallet.writeContract({ ...request, gas: (gas * 12n) / 10n });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      log(`plan ${id}: ${formatEther(ethIn)} ETH alım → ${receipt.status} (${hash})`);
    } catch (e) {
      failedUntil.set(id, now + BACKOFF_MS);
      log(`plan ${id}: atlandı — ${(e as Error).message.split("\n")[0]}`);
    }
  }
}

log(`keeper ${account.address} · ağ ${deployment.network} · vault ${deployment.dcaVault}`);
if (process.argv.includes("--once")) {
  await tick();
} else {
  for (;;) {
    await tick().catch((e) => log("tur hatası:", (e as Error).message));
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
