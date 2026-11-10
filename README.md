# Launchpad

[![CI](https://github.com/alisimsek55/launchpad/actions/workflows/ci.yml/badge.svg)](https://github.com/alisimsek55/launchpad/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Robinhood Chain üzerinde bonding curve tabanlı bir token launchpad'i (pump.fun / Pons benzeri). Herkes birkaç saniyede token çıkarır; token önce bonding curve'de işlem görür, **4.2 ETH** toplanınca likidite otomatik olarak **Uniswap v3**'e taşınır ve sonsuza kadar kilitlenir.

**🔗 Canlı demo (Robinhood testnet):** https://launchpad-cyan-nu.vercel.app

> ⚠️ **Öğrenme / portföy projesi.** Sözleşmeler bağımsız bir denetimden (audit) geçmedi. Herkese açık demo **Robinhood Chain testnet**'inde çalışır; gerçek parayla kullanmayın.

## Özellikler
- **Bonding curve:** sanal rezervli `x·y=k`, arzın %80'i curve'de; graduation fiyatı Uniswap açılış fiyatına birebir eşit (fiyat sıçraması yok).
- **Graduation:** tek işlemde Uniswap v3'e full-range likidite; LP NFT kilitli (rug pull yok). Fiyat manipülasyonuna ve kilitleme (DoS) saldırısına karşı korumalı.
- **Adil başlangıç:** ilk 60 sn alım fee'si %20 → %1 düşer (sniper koruması); creator launch işleminde en fazla %5 alabilir.
- **Fee:** %1 (%0.5 protokol / %0.5 creator), graduation sonrası Uniswap LP fee'leri de yarı yarıya.
- **DCA:** periyodik alım planı; keeper zamanı gelince curve'den veya Uniswap'ten alır.
- **Web:** token listesi, TradingView Lightweight Charts, alım-satım (curve + Uniswap), trades/holders, 2 adımlı token oluşturma (görsel **zincir üstünde**), profil/claim, analytics, docs.
- **Tamamen ücretsiz altyapı:** backend olarak tek bir indexer; sunucusuz metadata; keeper GitHub Actions'ta.

## Mimari
```
                 ┌──────────── Robinhood Chain (testnet 46630) ────────────┐
 Tarayıcı ──tx──▶│ TokenFactory · BondingCurve · Graduator · LPLocker      │
 (MetaMask)      │ FeeVault · DCAVault · LaunchToken · Uniswap v3 (kendi)  │
    │            └───────────────┬─────────────────────────────────────────┘
    │                 event'ler   │                       ▲ execute (30 dk)
    ▼                             ▼                       │
 Next.js (Vercel) ◀──REST── Ponder indexer (Render) ── Neon Postgres
                                                     GitHub Actions keeper
```

| Klasör | İçerik |
|---|---|
| `packages/contracts` | Solidity + Foundry: sözleşmeler, 40 test (unit/fuzz/invariant, mainnet fork), deploy script'leri |
| `packages/shared` | Ortak TS: zincir tanımları, deploy adresleri, curve matematiği (sözleşmeyle birebir), ABI'ler |
| `apps/indexer` | Ponder: tokenlar, işlemler, mumlar, holders, analytics + REST API |
| `apps/web` | Next.js 16 frontend |
| `apps/keeper` | DCA keeper (GitHub Actions'ta `--once`) |
| `packages/subgraph` | İsteğe bağlı Goldsky subgraph (web kullanmıyor) |

Kararlar ve gerekçeleri: [notes.md](notes.md), [reports/](reports/). Sabitler: [const.md](const.md).

## Gereksinimler
- Node 24+, pnpm 12+
- Foundry (`foundryup`)

## Kurulum
```bash
git clone --recurse-submodules https://github.com/alisimsek55/launchpad.git
cd launchpad
pnpm install
```

## Yerel geliştirme (anvil fork, tüm sistem)
Gerçek ağın yerel kopyasında sözleşmeler + örnek veri + indexer + site. Her komut ayrı terminalde:

1. Yerel zincir (1 sn blok süresi):
```bash
anvil --fork-url https://rpc.mainnet.chain.robinhood.com --block-time 1
```
2. Deploy + örnek tokenlar (adresleri `packages/shared/deployments/local.json`'a yazar):
```bash
cd packages/contracts && forge script script/Simulate.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --slow
```
3. Indexer ve site:
```bash
cd apps/indexer && rm -rf .ponder && LAUNCHPAD_NETWORK=local npx ponder dev
```
```bash
pnpm --filter @launchpad/web dev
```
4. (İsteğe bağlı) DCA keeper; yerelde anvil hesabı #0 yetkili (herkese açık test anahtarı, sadece yerelde):
```bash
cd apps/keeper && LAUNCHPAD_NETWORK=local POLL_MS=5000 KEEPER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 npx tsx src/index.ts
```
`http://localhost:3000` → **Connect** yerelde anvil test hesabını bağlar.

## Testnet'e ücretsiz yayın
Adım adım rehber: [reports/testnet-deploy.md](reports/testnet-deploy.md). Özet: faucet'ten test ETH'si → `DeployTestnet.s.sol` (kendi Uniswap v3'ümüzü de kurar) → indexer Render + Neon → web Vercel → keeper GitHub Actions secret'ı.

## DexScreener entegrasyonu
Indexer, [DEX Screener Adapter spesifikasyonunu (v1.1)](https://dexscreener.notion.site/DEX-Screener-Adapter-Specs-cc1223cdf6e74a7799599106b65dcd0e) uygular; DexScreener ve aynı formatı okuyan agregatörler (GMGN vb.) curve ve Uniswap işlemlerini buradan çeker. Kod: `apps/indexer/src/api/dexscreener.ts`.

| Uç nokta | Açıklama |
| --- | --- |
| `GET /dexscreener/latest-block` | Ponder'ın tamamen işlediği son blok |
| `GET /dexscreener/asset?id=<adres>` | Token (ad, sembol, toplam ve dolaşımdaki arz) veya WETH |
| `GET /dexscreener/pair?id=<adres>` | Curve veya Uniswap v3 pair'i |
| `GET /dexscreener/events?fromBlock=&toBlock=` | `swap`, `join` ve `exit` event'leri (iki sınır da dahil) |

Testnet adresi: `https://launchpad-indexer-nzgy.onrender.com/dexscreener/latest-block`

Kararlar:
- **Pair id:** Bonding curve aşamasında pair id **token adresidir**. Bütün curve'ler tek bir `BondingCurve` kontratında yaşar, curve'e özel kontrat adresi yoktur; token adresi her curve'ü tekil ve kalıcı olarak tanımlar (`dexKey: "launchpad"`). Graduation sonrası pair id **Uniswap v3 pool adresidir** (`dexKey: "uniswap"`). İkisi DexScreener'da aynı token'ın iki ayrı pair'i olarak görünür.
- **Sıra:** `asset0` Uniswap kuralıyla küçük adrestir (token veya WETH), iki pair'de de aynı. `priceNative` = 1 asset0'ın asset1 cinsinden fiyatı (işlem sonrası spot), 50 ondalığa kadar kesin.
- **Rezervler:** Curve'de **gerçek** rezervler (curve'deki ETH ve satılmamış curve arzı); sanal rezervler likiditeyi şişirirdi. v3 pool'unda likidite tam aralıkta olduğundan rezervler `L/√P` ve `L·√P` ile kesin hesaplanır.
- **Graduation:** Curve pair'i için `exit` (rezervler 0'a iner), pool için `join` (ilk likidite) event'i yayınlanır. Spec bir blokta `(txnIndex, eventIndex)` çiftinin tekil olmasını istediği için ikisi aynı tx'in farklı log'larına bağlanır.
- `/events`, henüz indekslenmemiş bir `toBlock` için 400 döner. DexScreener her bloğu bir kez sorduğu için boş yanıt veri kaybı olurdu.

**Listeleme:** Testnet zincirleri DexScreener'da listelenmez. Başvuru (DexScreener'a adapter adresini bildirmek) mainnet'e geçince yapılacak.

## Demo verisi
Canlı demo boş görünmesin diye testnet'e örnek tokenlar ve işlemler basan script (sadece testnet/local):
```bash
pnpm --filter @launchpad/keeper seed init    # demo cüzdanları (.seed-wallets.json, gitignore'da)
pnpm --filter @launchpad/keeper seed run     # fonla → 12 token oluştur → DURATION_MIN dk işlem
pnpm --filter @launchpad/keeper seed trade   # mevcut demo tokenlarında yeni işlem turu
```

## Komutlar
```bash
pnpm --filter @launchpad/contracts test       # Solidity testleri (mainnet fork, ~3 dk)
pnpm --filter @launchpad/contracts test:fast  # invariant hariç (~15 sn)
pnpm --filter @launchpad/contracts abis       # sözleşme değişince ABI'leri aktar
pnpm --filter @launchpad/shared test          # curve matematiği testleri
pnpm build                                    # tüm paketleri derle
```

## Ortam değişkenleri
Şablon: [env.example](env.example). Gizli değerler `.env`'ye veya barındırma panellerine girilir; repoya girmez.

## Lisans
[MIT](LICENSE)
