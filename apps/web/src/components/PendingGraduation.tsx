"use client";

import { graduatorAbi } from "@launchpad/shared";
import { zeroAddress, type Address } from "viem";
import { useReadContract } from "wagmi";
import { deployment } from "@/config";
import { useTx, useWrite } from "@/lib/useTx";
import { useWalletUI } from "@/wallet/context";

/// Graduation bekliyor mu? Curve kapandı ama Uniswap LP henüz açılmadı (Graduator.pending(token).creator != 0).
/// Indexer bayrağı (graduationPending) hızlı yol; zincir okuması indexer gecikmesini ve eski indexer'ı kapsar.
export function useGraduationPending(token: Address, t: { graduated: boolean; graduationPending?: boolean }) {
  const { data } = useReadContract({
    address: deployment.graduator,
    abi: graduatorAbi,
    functionName: "pending",
    args: [token],
    query: { enabled: !t.graduated, refetchInterval: 10_000 },
  });
  if (t.graduated) return false;
  if (data) return data[0] !== zeroAddress;
  return !!t.graduationPending;
}

/// Bekleyen graduation için curve işlem formunun yerine geçen panel.
export function PendingGraduation({ token }: { token: Address }) {
  const wallet = useWalletUI();
  const tx = useTx();
  const write = useWrite();
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Graduation sürüyor</p>
      <p className="text-xs text-muted">
        Curve doldu ve kapandı; Uniswap v3 pool&apos;unun fiyatı hedefe adım adım getiriliyor, LP açılınca işlemler
        Uniswap üzerinden sürer. Bu adımı herkes tamamlayabilir ve birkaç işlem sürebilir.
      </p>
      {wallet.connected ? (
        <button
          disabled={tx.busy}
          onClick={() =>
            tx.run(() =>
              write({ address: deployment.graduator, abi: graduatorAbi, functionName: "continueGraduation", args: [token] }),
            )
          }
          className="w-full rounded-xl bg-accent py-3 font-semibold text-black hover:bg-accent-strong disabled:opacity-40"
        >
          {tx.busy ? (tx.status === "pending" ? "Cüzdanda onayla…" : "Onay bekleniyor…") : "Graduation'ı tamamla"}
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
