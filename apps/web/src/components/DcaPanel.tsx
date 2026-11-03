"use client";

import { dcaVaultAbi } from "@launchpad/shared";
import { useState } from "react";
import { formatEther, parseEther, type Address } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { deployment } from "@/config";
import { fmtEth } from "@/lib/format";
import { useTx, useWrite } from "@/lib/useTx";
import { useWalletUI } from "@/wallet/context";

const INTERVALS = [
  { label: "1 saat", seconds: 3600 },
  { label: "4 saat", seconds: 4 * 3600 },
  { label: "1 gün", seconds: 86400 },
  { label: "1 hafta", seconds: 7 * 86400 },
];

function parse(s: string): bigint {
  try {
    return s ? parseEther(s) : 0n;
  } catch {
    return 0n;
  }
}

/// Periyodik alım: her aralıkta sabit ETH ile alım. Keeper çalıştırır, token'lar doğrudan cüzdana gelir.
export function DcaPanel({ token, symbol }: { token: Address; symbol: string }) {
  const { address } = useAccount();
  const wallet = useWalletUI();
  const write = useWrite();
  const tx = useTx();
  const [perBuy, setPerBuy] = useState("");
  const [count, setCount] = useState("10");
  const [interval, setIntervalSec] = useState(86400);
  const [maxPrice, setMaxPrice] = useState("");

  const per = parse(perBuy);
  const n = Math.max(0, Math.min(1000, Math.floor(Number(count) || 0)));
  const total = per * BigInt(n);
  const max = parse(maxPrice);

  async function create() {
    if (!address || per === 0n || n === 0) return;
    const ok = await tx.run(() =>
      write({
        address: deployment.dcaVault,
        abi: dcaVaultAbi,
        functionName: "createPlan",
        args: [token, per, interval, n, max],
        value: total,
      }),
    );
    if (ok) setPerBuy("");
  }

  const input = "w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-muted";

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Her aralıkta sabit tutarla otomatik alım. Fiyatı tahmin etmeye çalışmadan ortalama maliyetle birikim yapar.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted">Alım başına (ETH)</label>
          <input className={input} inputMode="decimal" placeholder="0.01" value={perBuy} onChange={(e) => setPerBuy(e.target.value.replace(",", "."))} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Alım sayısı</label>
          <input className={input} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {INTERVALS.map((i) => (
          <button
            key={i.seconds}
            onClick={() => setIntervalSec(i.seconds)}
            className={`rounded-full px-3 py-1 text-xs ${interval === i.seconds ? "bg-surface-2 text-foreground" : "text-muted"}`}
          >
            {i.label}
          </button>
        ))}
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">En yüksek fiyat (isteğe bağlı, token başına ETH)</label>
        <input className={input} inputMode="decimal" placeholder="sınır yok" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(",", "."))} />
        <p className="mt-1 text-xs text-muted">Fiyat bunun üstündeyse o tur alım yapılmaz.</p>
      </div>
      <div className="flex justify-between rounded-xl bg-surface-2 p-3 text-sm">
        <span className="text-muted">Toplam yatırılacak</span>
        <span className="font-semibold">{fmtEth(Number(formatEther(total)))} ETH</span>
      </div>
      {wallet.connected ? (
        <button
          onClick={create}
          disabled={tx.busy || per === 0n || n === 0}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-black disabled:opacity-40"
        >
          {tx.busy ? "Onay bekleniyor…" : `DCA başlat · ${symbol}`}
        </button>
      ) : (
        <button onClick={wallet.connect} disabled={!!wallet.unavailableReason} title={wallet.unavailableReason} className="w-full rounded-xl bg-accent py-3 font-semibold text-black disabled:opacity-40">
          Sign in
        </button>
      )}
      {tx.error && <p className="break-words text-xs text-danger">{tx.error}</p>}
      {address && <MyPlans owner={address} token={token} />}
    </div>
  );
}

function MyPlans({ owner, token }: { owner: Address; token: Address }) {
  const write = useWrite();
  const tx = useTx();
  const { data: ids } = useReadContract({
    address: deployment.dcaVault,
    abi: dcaVaultAbi,
    functionName: "planIds",
    args: [owner],
    query: { refetchInterval: 5_000 },
  });
  const { data: plans } = useReadContracts({
    contracts: (ids ?? []).map((id) => ({
      address: deployment.dcaVault,
      abi: dcaVaultAbi,
      functionName: "plans" as const,
      args: [id] as const,
    })),
    query: { enabled: !!ids?.length, refetchInterval: 5_000 },
  });

  const mine = (ids ?? [])
    .map((id, i) => ({ id, plan: plans?.[i]?.result }))
    .filter((p) => p.plan && p.plan[1].toLowerCase() === token.toLowerCase());
  if (mine.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <div className="text-xs text-muted">Planların</div>
      {mine.map(({ id, plan }) => {
        const [, , ethPerBuy, balance, intervalSec, , executions] = plan!;
        const active = balance > 0n;
        return (
          <div key={String(id)} className="flex items-center justify-between rounded-xl bg-surface-2 p-3 text-xs">
            <div>
              <div className="font-medium text-foreground">
                {fmtEth(Number(formatEther(ethPerBuy)))} ETH / {intervalSec >= 86400 ? `${intervalSec / 86400}g` : `${intervalSec / 3600}s`}
              </div>
              <div className="text-muted">
                {executions} alım yapıldı · kalan {fmtEth(Number(formatEther(balance)))} ETH
              </div>
            </div>
            {active ? (
              <button
                disabled={tx.busy}
                onClick={() =>
                  tx.run(() => write({ address: deployment.dcaVault, abi: dcaVaultAbi, functionName: "cancelPlan", args: [id] }))
                }
                className="rounded-full border border-line px-3 py-1 text-muted hover:text-foreground disabled:opacity-40"
              >
                İptal
              </button>
            ) : (
              <span className="text-muted">Bitti</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
