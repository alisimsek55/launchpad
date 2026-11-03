"use client";

import { VIRTUAL_ETH, VIRTUAL_TOKEN, initialCurve, quoteBuy, tokenFactoryAbi } from "@launchpad/shared";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatEther, parseEther, parseEventLogs } from "viem";
import { useAccount } from "wagmi";
import { deployment } from "@/config";
import { uploadMetadata } from "@/data/hooks";
import { fmtCompact } from "@/lib/format";
import { useTx, useWrite } from "@/lib/useTx";
import { useWalletUI } from "@/wallet/context";

const LAUNCH_FEE = parseEther("0.0005");
const MAX_DEV_BUY_TOKENS = 50_000_000n * 10n ** 18n; // %5
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const LINK = /(https?:\/\/|www\.)/i;

/// %5 token sınırına denk gelen en yüksek dev buy (fee dahil): (k / (y0 - 50M) - x0) / 0.99
const MAX_DEV_BUY_ETH =
  (((VIRTUAL_ETH * VIRTUAL_TOKEN) / (VIRTUAL_TOKEN - MAX_DEV_BUY_TOKENS) - VIRTUAL_ETH) * 10_000n) / 9_900n;

function parseEth(s: string): bigint {
  try {
    return s ? parseEther(s) : 0n;
  } catch {
    return -1n;
  }
}

export function CreateTokenForm() {
  const router = useRouter();
  const wallet = useWalletUI();
  const { address } = useAccount();
  const mutateAsync = useWrite();
  const tx = useTx();

  const [step, setStep] = useState<1 | 2>(1);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [x, setX] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [devBuy, setDevBuy] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  const identityError = useMemo(() => {
    if (!image) return "Görsel seç";
    if (!name.trim() || name.length > 32) return "İsim 1-32 karakter";
    if (!symbol.trim() || symbol.length > 10) return "Ticker 1-10 karakter";
    if (LINK.test(description)) return "Açıklamada link olamaz";
    if (website && !website.startsWith("https://")) return "Website https:// ile başlamalı";
    return null;
  }, [image, name, symbol, description, website]);

  const devEth = parseEth(devBuy);
  const devTokens = devEth > 0n ? quoteBuy(initialCurve(), devEth).tokenOut : 0n;
  const devTooLarge = devTokens > MAX_DEV_BUY_TOKENS;

  function pickImage(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_IMAGE_BYTES) return setError("Görsel en fazla 5 MB");
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(f.type))
      return setError("PNG, JPG, WEBP veya GIF");
    setError(undefined);
    setImage(f);
    setPreview(URL.createObjectURL(f));
  }

  async function launch() {
    if (!image || !address || devEth < 0n || devTooLarge) return;
    setError(undefined);
    setUploading(true);
    let uri: string;
    try {
      const form = new FormData();
      Object.entries({ name, symbol, description, x, telegram, website }).forEach(([k, v]) => form.append(k, v.trim()));
      form.append("image", image);
      uri = (await uploadMetadata(form)).uri;
    } catch (e) {
      setError((e as Error).message);
      return;
    } finally {
      setUploading(false);
    }

    const minDevTokens = (devTokens * 99n) / 100n; // %1 slippage
    const receipt = await tx.run(() =>
      mutateAsync({
        address: deployment.tokenFactory,
        abi: tokenFactoryAbi,
        functionName: "createToken",
        args: [name.trim(), symbol.trim().toUpperCase(), uri, minDevTokens],
        value: LAUNCH_FEE + devEth,
      }),
    );
    if (!receipt) return;
    const [created] = parseEventLogs({ abi: tokenFactoryAbi, eventName: "TokenCreated", logs: receipt.logs });
    if (created) router.push(`/token/${created.args.token}`);
  }

  const input = "w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-muted";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Launch a token.</h1>
          <p className="mt-2 text-sm text-muted">
            İki adım: isim ve görsel ver, ilk alımını belirle. İmzaladığın anda curve açılır.
          </p>
        </div>

        <div className="space-y-5 rounded-2xl border border-line bg-surface p-6">
          <div className="flex gap-4 text-sm">
            <span className={step === 1 ? "font-semibold" : "text-muted"}>① Identity</span>
            <span className={step === 2 ? "font-semibold" : "text-muted"}>② Economics</span>
          </div>

          {step === 1 ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted">Image</label>
                <label className="flex cursor-pointer items-center gap-4">
                  <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element -- yerel önizleme */}
                    {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="text-muted">+</span>}
                  </span>
                  <span className="rounded-full border border-line px-4 py-1.5 text-sm">Choose image</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
                </label>
                <p className="mt-1 text-xs text-muted">Kare, en fazla 5 MB</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted">Name</label>
                  <input className={input} maxLength={32} placeholder="Pons Coin" value={name} onChange={(e) => setName(e.target.value)} />
                  <p className="mt-1 text-xs text-muted">{name.length}/32</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Ticker</label>
                  <input className={input} maxLength={10} placeholder="PONS" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
                  <p className="mt-1 text-xs text-muted">{symbol.length}/10</p>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Description</label>
                <textarea className={input} rows={3} maxLength={256} placeholder="Bir iki cümle. Link yok." value={description} onChange={(e) => setDescription(e.target.value)} />
                <p className="mt-1 text-xs text-muted">{description.length}/256</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input className={input} placeholder="X: @handle" value={x} onChange={(e) => setX(e.target.value)} />
                <input className={input} placeholder="Telegram" value={telegram} onChange={(e) => setTelegram(e.target.value)} />
                <input className={input} placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <div className="flex items-center justify-end gap-3">
                {identityError && <span className="text-xs text-muted">{identityError}</span>}
                <button
                  disabled={!!identityError}
                  onClick={() => setStep(2)}
                  className="rounded-xl bg-accent px-6 py-2.5 font-semibold text-black disabled:opacity-40"
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted">İlk alımın (isteğe bağlı, ETH)</label>
                <input className={input} inputMode="decimal" placeholder="0" value={devBuy} onChange={(e) => setDevBuy(e.target.value.replace(",", "."))} />
                <p className={`mt-1 text-xs ${devTooLarge ? "text-danger" : "text-muted"}`}>
                  {devTooLarge
                    ? `En fazla ${Number(formatEther(MAX_DEV_BUY_ETH)).toFixed(4)} ETH (arzın %5'i).`
                    : devTokens > 0n
                      ? `≈ ${fmtCompact(Number(formatEther(devTokens)))} token · sniper'lardan önce, %1 fee ile`
                      : `Launch tx'inde sniper'lardan önce alırsın. Üst sınır %5 ≈ ${Number(formatEther(MAX_DEV_BUY_ETH)).toFixed(4)} ETH.`}
                </p>
              </div>
              <div className="space-y-1 rounded-xl bg-surface-2 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted">Launch fee</span><span>0.0005 ETH</span></div>
                <div className="flex justify-between"><span className="text-muted">İlk alım</span><span>{devEth > 0n ? formatEther(devEth) : "0"} ETH</span></div>
                <div className="flex justify-between font-semibold"><span>Toplam</span><span>{formatEther(LAUNCH_FEE + (devEth > 0n ? devEth : 0n))} ETH</span></div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <button onClick={() => setStep(1)} className="text-sm text-muted hover:text-foreground">← Geri</button>
                {wallet.connected ? (
                  <button
                    onClick={launch}
                    disabled={uploading || tx.busy || devEth < 0n || devTooLarge}
                    className="rounded-xl bg-accent px-6 py-2.5 font-semibold text-black disabled:opacity-40"
                  >
                    {uploading ? "Yükleniyor…" : tx.busy ? "İmzala / bekle…" : "Launch"}
                  </button>
                ) : (
                  <button onClick={wallet.connect} disabled={!!wallet.unavailableReason} title={wallet.unavailableReason} className="rounded-xl bg-accent px-6 py-2.5 font-semibold text-black disabled:opacity-40">
                    Sign in
                  </button>
                )}
              </div>
            </>
          )}
          {(error || tx.error) && <p className="break-words text-xs text-danger">{error ?? tx.error}</p>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-muted">On the board</p>
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- yerel önizleme */}
            {preview ? <img src={preview} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <span className="h-14 w-14 rounded-xl bg-surface-2" />}
            <div>
              <div className="text-lg font-semibold">{name || "Your token"}</div>
              <div className="text-xs text-muted">{symbol || "TICKER"} · ETH pair</div>
            </div>
          </div>
          <p className="text-sm text-muted">{description || "Token hakkında bir iki satır."}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-muted">Supply</div>1,000,000,000</div>
            <div><div className="text-xs text-muted">Graduates at</div>4.20 ETH</div>
            <div><div className="text-xs text-muted">Creator fee</div>0.5% / işlem</div>
            <div><div className="text-xs text-muted">Launch fee</div>0.0005 ETH</div>
          </div>
        </div>
      </div>
    </div>
  );
}
