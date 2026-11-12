"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BaseError, ContractFunctionRevertedError, type Abi, type Address, type Hash, type TransactionReceipt } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { chain } from "@/config";

type WriteParams = {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

/// Kontrat yazma:
/// - Cüzdan başka ağdaysa önce Robinhood Chain'e geçirir (ağ cüzdanda yoksa eklemeyi önerir).
/// - %20 gas payı ekler: tahmin edilen limit, iç içe ETH transferli çağrılarda
///   (ör. Uniswap multicall → WETH.withdraw → router.receive) 63/64 kuralı yüzünden yetmeyebiliyor.
export function useWrite() {
  const client = usePublicClient({ chainId: chain.id });
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { mutateAsync } = useWriteContract();
  return async (params: WriteParams): Promise<Hash> => {
    if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
    const estimate = await client!.estimateContractGas({ ...params, account: address } as never);
    return mutateAsync({ ...params, chainId: chain.id, gas: (estimate * 12n) / 10n } as never);
  };
}

/// Kontrat revert hatalarının kullanıcıya gösterilen Türkçe karşılıkları (hata adı → mesaj).
/// Listede olmayan hata viem'in kısa mesajıyla gösterilir.
const REVERT_MESSAGES: Record<string, string> = {
  AlreadyGraduated: "Bu token'ın curve'ü kapandı (graduation); işlem artık Uniswap üzerinden yapılır.",
  Expired: "İşlemin süresi doldu, tekrar dene.",
  Slippage: "Fiyat beklenenden fazla oynadı (slippage); tekrar dene ya da slippage'ı artır.",
  ZeroAmount: "Tutar sıfır olamaz.",
  DevBuyTooLarge: "İlk alım (dev buy) üst sınırı aşıyor.",
  InsufficientLaunchFee: "Launch ücreti eksik gönderildi.",
  NothingToClaim: "Çekilecek ücret yok.",
  NotOwner: "Bu plan sana ait değil.",
  PlanFinished: "Bu DCA planı zaten bitmiş.",
  TooEarly: "Bir sonraki DCA alımının zamanı henüz gelmedi.",
  NotPending: "Bekleyen bir graduation yok; büyük ihtimalle az önce tamamlandı.",
  PriceTooHigh: "Fiyat, planın en yüksek fiyat (maxPrice) sınırının üstünde; alım bekletiliyor.",
  PriceManipulated: "Pool fiyatı 5 dakikalık ortalamadan (TWAP) çok saptı; olası manipülasyona karşı alım yapılmadı.",
  TwapUnavailable: "Pool'un fiyat geçmişi (TWAP) henüz yetersiz; bu planda en yüksek fiyat (maxPrice) yoksa alım yapılamaz.",
};

/// Hatayı okunabilir Türkçe mesaja çevirir; bilinen kontrat revert'leri için REVERT_MESSAGES kullanılır.
export function txErrorMessage(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError);
    const name = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
    if (name && REVERT_MESSAGES[name]) return REVERT_MESSAGES[name];
    return e.shortMessage;
  }
  return (e as Error).message;
}

type Status = "idle" | "pending" | "confirming" | "success" | "error";

/// İşlem gönder → onay bekle → verileri tazele. Kullanıcıya okunabilir hata mesajı döner.
export function useTx() {
  const client = usePublicClient({ chainId: chain.id });
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>();
  const [hash, setHash] = useState<Hash>();

  async function run(send: () => Promise<Hash>): Promise<TransactionReceipt | undefined> {
    setError(undefined);
    setStatus("pending");
    try {
      const h = await send();
      setHash(h);
      setStatus("confirming");
      const receipt = await client!.waitForTransactionReceipt({ hash: h });
      if (receipt.status !== "success") throw new Error("İşlem geri döndü (reverted)");
      setStatus("success");
      await queryClient.invalidateQueries();
      return receipt;
    } catch (e) {
      setStatus("error");
      setError(txErrorMessage(e));
    }
  }

  return { run, status, error, hash, busy: status === "pending" || status === "confirming" };
}
