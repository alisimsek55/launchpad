"use client";

import { bondingCurveAbi, launchTokenAbi } from "@launchpad/shared";
import { useState } from "react";
import { encodeFunctionData, erc20Abi, formatEther, maxUint256, parseEther, type Address } from "viem";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { DEFAULT_SLIPPAGE_BPS, GRADUATION_ETH, deployment } from "@/config";
import { useToken } from "@/data/hooks";
import { fmtEth } from "@/lib/format";
import { ADDRESS_THIS, UNI_FEE_TIER, quoterV2Abi, swapRouter02Abi } from "@/lib/uniswap";
import { useTx, useWrite } from "@/lib/useTx";
import { useWalletUI } from "@/wallet/context";
import { DcaPanel } from "./DcaPanel";
import { Usd } from "./Usd";

// Ağın WETH/Uniswap adresleri deploy dosyasından (testnet'te kendi Uniswap deploy'umuz)
const UNI = {
  weth: deployment.weth,
  uniSwapRouter02: deployment.uniSwapRouter02,
  uniQuoterV2: deployment.uniQuoterV2,
};
const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 300);
const withSlippage = (v: bigint, bps: number) => (v * BigInt(10_000 - bps)) / 10_000n;

function parseAmount(s: string): bigint {
  try {
    return s ? parseEther(s) : 0n;
  } catch {
    return 0n;
  }
}

/// Alım-satım paneli. Graduation öncesi curve, sonrası Uniswap v3 (SwapRouter02) üzerinden.
export function TradePanel({ token, symbol, graduated }: { token: Address; symbol: string; graduated: boolean }) {
  const { address } = useAccount();
  const wallet = useWalletUI();
  const [mode, setMode] = useState<"market" | "dca">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [input, setInput] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const amount = parseAmount(input);
  const tx = useTx();
  const mutateAsync = useWrite();

  const { data: ethBal } = useBalance({ address, query: { enabled: !!address, refetchInterval: 5_000 } });
  const { data: tokenBal } = useReadContract({
    address: token,
    abi: launchTokenAbi,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: !!address, refetchInterval: 5_000 },
  });
  const spender = graduated ? UNI.uniSwapRouter02 : deployment.bondingCurve;
  const { data: allowance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address!, spender],
    query: { enabled: !!address && side === "sell" },
  });

  // ---- teklif (quote)
  const curveQuote = useReadContract({
    address: deployment.bondingCurve,
    abi: bondingCurveAbi,
    functionName: side === "buy" ? "quoteBuy" : "quoteSell",
    args: [token, amount],
    query: { enabled: !graduated && amount > 0n, refetchInterval: 5_000 },
  });
  const uniQuote = useReadContract({
    address: UNI.uniQuoterV2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn: side === "buy" ? UNI.weth : token,
        tokenOut: side === "buy" ? token : UNI.weth,
        amountIn: amount,
        fee: UNI_FEE_TIER,
        sqrtPriceLimitX96: 0n,
      },
    ],
    query: { enabled: graduated && amount > 0n, refetchInterval: 5_000 },
  });
  const quoteOut: bigint | undefined = graduated
    ? uniQuote.data?.[0]
    : (curveQuote.data as readonly [bigint, bigint] | undefined)?.[0];
  const minOut = quoteOut !== undefined ? withSlippage(quoteOut, slippageBps) : undefined;

  // USD göstergesi için ETH karşılıkları; token tarafı anlık spot fiyatla değerlenir
  const priceEth = useToken(token).data?.priceEth;
  const amountNum = Number(formatEther(amount));
  const quoteNum = quoteOut !== undefined ? Number(formatEther(quoteOut)) : undefined;
  const toEth = (v: number | undefined, isEth: boolean) =>
    v === undefined ? undefined : isEth ? v : priceEth !== undefined ? v * priceEth : undefined;
  const payEth = amount > 0n ? toEth(amountNum, side === "buy") : undefined;
  const receiveEth = toEth(quoteNum, side === "sell");

  const balance = side === "buy" ? ethBal?.value : tokenBal;
  const insufficient = balance !== undefined && amount > balance;

  function setPct(pct: number) {
    if (balance === undefined) return;
    // Alımda gas için biraz ETH bırak
    let v = (balance * BigInt(pct)) / 100n;
    if (side === "buy" && pct === 100) v = v > parseEther("0.0005") ? v - parseEther("0.0005") : 0n;
    setInput(formatEther(v));
  }

  async function submit() {
    if (!address || minOut === undefined || amount === 0n) return;
    if (side === "sell" && (allowance ?? 0n) < amount) {
      const ok = await tx.run(() =>
        mutateAsync({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, maxUint256] }),
      );
      if (!ok) return;
    }

    const receipt = await tx.run(() => {
      if (!graduated) {
        return side === "buy"
          ? mutateAsync({
              address: deployment.bondingCurve,
              abi: bondingCurveAbi,
              functionName: "buy",
              args: [token, minOut, deadline(), address],
              value: amount,
            })
          : mutateAsync({
              address: deployment.bondingCurve,
              abi: bondingCurveAbi,
              functionName: "sell",
              args: [token, amount, minOut, deadline(), address],
            });
      }
      if (side === "buy") {
        return mutateAsync({
          address: UNI.uniSwapRouter02,
          abi: swapRouter02Abi,
          functionName: "exactInputSingle",
          args: [
            {
              tokenIn: UNI.weth,
              tokenOut: token,
              fee: UNI_FEE_TIER,
              recipient: address,
              amountIn: amount,
              amountOutMinimum: minOut,
              sqrtPriceLimitX96: 0n,
            },
          ],
          value: amount,
        });
      }
      // Token -> WETH (router'da kalır) -> ETH olarak kullanıcıya
      const swap = encodeFunctionData({
        abi: swapRouter02Abi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: token,
            tokenOut: UNI.weth,
            fee: UNI_FEE_TIER,
            recipient: ADDRESS_THIS,
            amountIn: amount,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      const unwrap = encodeFunctionData({ abi: swapRouter02Abi, functionName: "unwrapWETH9", args: [minOut, address] });
      return mutateAsync({
        address: UNI.uniSwapRouter02,
        abi: swapRouter02Abi,
        functionName: "multicall",
        args: [deadline(), [swap, unwrap]],
      });
    });
    if (receipt) setInput("");
  }

  const outSymbol = side === "buy" ? symbol : "ETH";
  const inSymbol = side === "buy" ? "ETH" : symbol;

  const modeTabs = (
    <div className="grid grid-cols-2 rounded-full bg-surface-2 p-1 text-sm font-medium">
      {(["market", "dca"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`rounded-full py-1.5 ${mode === m ? "bg-background text-foreground" : "text-muted"}`}
        >
          {m === "market" ? "Market" : "DCA"}
        </button>
      ))}
    </div>
  );

  if (mode === "dca") {
    return (
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
        {modeTabs}
        <DcaPanel token={token} symbol={symbol} />
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      {modeTabs}
      <p className="text-xs text-muted">
        {graduated ? "Graduated · Uniswap v3 pool'unda işlem görüyor." : `Bonding curve · ${GRADUATION_ETH} ETH'de Uniswap v3'e geçer.`}
      </p>

      <div className="grid grid-cols-2 rounded-full bg-surface-2 p-1 text-sm font-medium">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSide(s);
              setInput("");
            }}
            className={`rounded-full py-1.5 capitalize ${side === s ? "bg-background text-foreground" : "text-muted"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-xl bg-surface-2 p-3">
        <div className="flex justify-between text-xs text-muted">
          <span>Pay</span>
          {balance !== undefined && (
            <span>
              Bakiye: {fmtEth(Number(formatEther(balance)))} {inSymbol}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            placeholder="0"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(",", "."))}
            className="w-full bg-transparent text-3xl font-semibold outline-none placeholder:text-muted"
          />
          <span className="text-lg font-semibold text-muted">{inSymbol}</span>
        </div>
        <Usd eth={payEth} className="block text-xs text-muted" />
        <div className="flex gap-2">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              onClick={() => setPct(p)}
              className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:text-foreground"
            >
              {p === 100 ? "Max" : `${p}%`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-muted">You receive (tahmini)</div>
        <div className="text-xl font-semibold">
          {quoteOut !== undefined ? fmtEth(Number(formatEther(quoteOut)), 4) : "0"}{" "}
          <span className="text-sm text-muted">{outSymbol}</span>
        </div>
        <Usd eth={receiveEth} className="block text-xs text-muted" />
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>Slippage</span>
        <div className="flex gap-1">
          {[50, 100, 300].map((b) => (
            <button
              key={b}
              onClick={() => setSlippageBps(b)}
              className={`rounded-full px-2 py-0.5 ${slippageBps === b ? "bg-surface-2 text-foreground" : ""}`}
            >
              {b / 100}%
            </button>
          ))}
        </div>
      </div>

      {wallet.connected ? (
        <button
          onClick={submit}
          disabled={tx.busy || amount === 0n || insufficient || minOut === undefined}
          className={`w-full rounded-xl py-3 font-semibold text-black disabled:opacity-40 ${side === "buy" ? "bg-accent hover:bg-accent-strong" : "bg-danger"}`}
        >
          {tx.busy
            ? tx.status === "pending"
              ? "Cüzdanda onayla…"
              : "Onay bekleniyor…"
            : insufficient
              ? "Yetersiz bakiye"
              : side === "buy"
                ? `Buy ${symbol}`
                : `Sell ${symbol}`}
        </button>
      ) : (
        <button
          onClick={wallet.connect}
          disabled={!!wallet.unavailableReason}
          title={wallet.unavailableReason}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-black disabled:opacity-40"
        >
          Sign in
        </button>
      )}
      {tx.error && <p className="break-words text-xs text-danger">{tx.error}</p>}
      {tx.status === "success" && <p className="text-xs text-accent">İşlem onaylandı.</p>}
    </div>
  );
}
