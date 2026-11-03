"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BaseError, type Abi, type Address, type Hash, type TransactionReceipt } from "viem";

type WriteParams = {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

/// Kontrat yazma + %20 gas payı. Tahmin edilen limit, iç içe ETH transferli çağrılarda
/// (ör. Uniswap multicall → WETH.withdraw → router.receive) 63/64 kuralı yüzünden yetmeyebiliyor.
export function useWrite() {
  const client = usePublicClient();
  const { address } = useAccount();
  const { mutateAsync } = useWriteContract();
  return async (params: WriteParams): Promise<Hash> => {
    const estimate = await client!.estimateContractGas({ ...params, account: address } as never);
    return mutateAsync({ ...params, gas: (estimate * 12n) / 10n } as never);
  };
}

type Status = "idle" | "pending" | "confirming" | "success" | "error";

/// İşlem gönder → onay bekle → verileri tazele. Kullanıcıya okunabilir hata mesajı döner.
export function useTx() {
  const client = usePublicClient();
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
      setError(e instanceof BaseError ? e.shortMessage : (e as Error).message);
    }
  }

  return { run, status, error, hash, busy: status === "pending" || status === "confirming" };
}
