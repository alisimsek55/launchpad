"use client";

import { feeVaultAbi, lpLockerAbi, nameFromAddress } from "@launchpad/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatEther, getAddress, isAddress, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { deployment } from "@/config";
import { useTokens, useTokensByCreator, useWalletBalances } from "@/data/hooks";
import { fmtCompact, fmtEth, shortAddr } from "@/lib/format";
import { useTx, useWrite } from "@/lib/useTx";
import { Avatar } from "./Avatar";
import { GraduationBar } from "./GraduationBar";
import { TokenImage } from "./TokenImage";
import { Usd } from "./Usd";

export function ProfileView() {
  const params = useParams<{ address: string }>();
  if (!isAddress(params.address)) return <p className="text-muted">Geçersiz adres.</p>;
  return <Profile user={getAddress(params.address)} />;
}

function Profile({ user }: { user: Address }) {
  const { address: me } = useAccount();
  const isMe = me?.toLowerCase() === user.toLowerCase();
  const created = useTokensByCreator(user);
  const balances = useWalletBalances(user);
  const allTokens = useTokens("new", 500);
  const tokenByAddr = new Map(allTokens.data?.map((t) => [t.address.toLowerCase(), t]));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Avatar address={user} size={64} />
        <div>
          <h1 className="text-2xl font-semibold">{nameFromAddress(user)}</h1>
          <p className="font-mono text-sm text-muted">{user}</p>
        </div>
      </div>

      <CreatorFees user={user} isMe={isMe} graduated={created.data?.filter((t) => t.graduated).map((t) => t.address) ?? []} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Oluşturduğu tokenlar ({created.data?.length ?? 0})</h2>
        {created.data?.length === 0 && <p className="text-sm text-muted">Henüz token oluşturmamış.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {created.data?.map((t) => (
            <Link key={t.address} href={`/token/${t.address}`} className="space-y-3 rounded-2xl border border-line bg-surface p-4 hover:border-muted">
              <div className="flex items-center gap-3">
                <TokenImage address={t.address} metadataURI={t.metadataURI} symbol={t.symbol} size={40} />
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted">
                    ${t.symbol} · creator kazancı {fmtEth(t.creatorFeesEth)} ETH
                    <Usd eth={t.creatorFeesEth} prefix=" · ≈ " />
                  </div>
                </div>
              </div>
              <GraduationBar realEth={t.realEth} graduated={t.graduated} pending={t.graduationPending} />
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tuttuğu tokenlar</h2>
        {balances.data?.length === 0 && <p className="text-sm text-muted">Token tutmuyor.</p>}
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {balances.data?.map((b) => {
            const t = tokenByAddr.get(b.token.toLowerCase());
            const amount = Number(formatEther(BigInt(b.balance)));
            return (
              <Link key={b.token} href={`/token/${b.token}`} className="flex items-center gap-3 p-3 hover:bg-surface-2">
                {t ? (
                  <TokenImage address={t.address} metadataURI={t.metadataURI} symbol={t.symbol} size={32} />
                ) : (
                  <span className="h-8 w-8 rounded-xl bg-surface-2" />
                )}
                <div className="flex-1">
                  <div className="font-medium">{t?.name ?? shortAddr(b.token)}</div>
                  <div className="text-xs text-muted">{t ? `$${t.symbol}` : ""}</div>
                </div>
                <div className="text-right text-sm">
                  <div>{fmtCompact(amount)}</div>
                  {t && (
                    <div className="text-xs text-muted">
                      ≈ {fmtEth(amount * t.priceEth)} ETH
                      <Usd eth={amount * t.priceEth} prefix=" · ≈ " />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/// Creator'ın FeeVault'taki birikmiş payı + graduate tokenların Uniswap LP fee'lerini toplama.
function CreatorFees({ user, isMe, graduated }: { user: Address; isMe: boolean; graduated: Address[] }) {
  const mutateAsync = useWrite();
  const tx = useTx();
  const { data: claimable } = useReadContract({
    address: deployment.feeVault,
    abi: feeVaultAbi,
    functionName: "creatorBalance",
    args: [user],
    query: { refetchInterval: 5_000 },
  });
  if (!claimable && graduated.length === 0) return null;

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4">
      <div>
        <div className="text-xs text-muted">Çekilebilir creator kazancı</div>
        <div className="text-xl font-semibold">{fmtEth(Number(formatEther(claimable ?? 0n)), 6)} ETH</div>
        <Usd eth={Number(formatEther(claimable ?? 0n))} className="text-xs text-muted" />
      </div>
      {isMe && (
        <div className="ml-auto flex gap-2">
          {graduated.length > 0 && (
            <button
              disabled={tx.busy}
              onClick={async () => {
                for (const token of graduated) {
                  const receipt = await tx.run(() =>
                    mutateAsync({ address: deployment.lpLocker, abi: lpLockerAbi, functionName: "collect", args: [token] }),
                  );
                  // run() reddedilen/başarısız işlemde undefined döner (hata tx.error'da); kalanlar için cüzdan istemini tekrar açma
                  if (receipt?.status !== "success") break;
                }
              }}
              className="rounded-xl border border-line px-4 py-2 text-sm disabled:opacity-40"
              title="Graduate olan tokenların Uniswap LP fee'lerini kasaya aktarır"
            >
              Uniswap fee&apos;lerini topla
            </button>
          )}
          <button
            disabled={tx.busy || !claimable}
            onClick={() =>
              // claimCreatorFees overload'lu (recipient'li sürüm de var); args: [] argümansız sürümü seçtirir
              tx.run(() => mutateAsync({ address: deployment.feeVault, abi: feeVaultAbi, functionName: "claimCreatorFees", args: [] }))
            }
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            Claim
          </button>
        </div>
      )}
      {tx.error && <p className="w-full text-xs text-danger">{tx.error}</p>}
    </section>
  );
}
