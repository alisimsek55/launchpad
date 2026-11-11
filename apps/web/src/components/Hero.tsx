import Image from "next/image";
import Link from "next/link";
import { GRADUATION_ETH, isTestnet } from "@/config";
import heroBg from "../../public/hero-bg.webp";

// Ana sayfa hero'su. Görsel dekoratif: eğri alt/sağda, metin üstteki koyu boşlukta durur.
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-line bg-background">
      <Image
        src={heroBg}
        alt=""
        aria-hidden
        fill
        // Sayfanın ilk ve en büyük görseli: LCP'yi geciktirmemek için hemen ve yüksek öncelikle yüklenir
        loading="eager"
        fetchPriority="high"
        sizes="(max-width: 1280px) 100vw, 1248px"
        placeholder="blur"
        className="-z-10 object-cover object-[70%_100%] sm:object-[right_bottom]"
      />
      {/* Metnin arkasını koyulaştırır ve görselin kenarlarını sayfa arka planına eritir */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-background/80 via-background/30 to-background/10 sm:bg-gradient-to-r sm:from-background/90 sm:via-background/40 sm:to-transparent"
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-10 bg-gradient-to-t from-background/70 to-transparent" />

      <div className="flex min-h-[440px] flex-col px-6 pb-40 pt-10 sm:min-h-[420px] sm:px-10 sm:pb-28 sm:pt-14 lg:min-h-[460px]">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Robinhood Chain launchpad</p>
        <h1 className="mt-3 max-w-xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Tokenını bonding curve ile başlat
        </h1>
        <p className="mt-4 max-w-lg text-base text-foreground/80">
          Her token bonding curve üzerinde başlar, {GRADUATION_ETH} ETH&apos;de Uniswap v3&apos;e geçer. Likidite sonsuza
          kadar kilitli.
        </p>
        {isTestnet && (
          <p className="mt-2 max-w-lg text-sm text-muted">Robinhood testnet demosu: test ETH&apos;si faucet&apos;ten ücretsiz.</p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/create"
            className="rounded-xl bg-accent px-6 py-2.5 font-semibold text-black transition hover:bg-accent-strong"
          >
            Token oluştur
          </Link>
          <Link
            href="/docs"
            className="rounded-xl border border-line bg-background/60 px-6 py-2.5 font-semibold text-foreground transition hover:border-muted"
          >
            Nasıl çalışır?
          </Link>
        </div>
      </div>
    </section>
  );
}
