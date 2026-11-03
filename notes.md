# Notlar

## Referans: Pons (Robinhood Chain üzerinde token launchpad)

Ekran görüntülerinden çıkanlar:
- Token'lar bir bonding curve ile başlıyor, **4.20 ETH**'ye ulaşınca "graduate" olup Uniswap v3 havuzuna geçiyor ("first generation launch, trades on its Uniswap v3 pool").
- Arz sabit: **1.000.000.000**. Launch fee **0.0005 ETH**, creator fee ayarlanabilir (varsayılan %0).
- Eşleşme seçenekleri: ETH, stablecoin (USDG), hisse/ETF token'ları (NVDA vb.).

## Yapılacak modüller

### 1. Alım-satım paneli
- **v1: sadece Market + DCA.** Limit emirler v1'de yok, faz 2'ye kaldı.
- Buy / Sell geçişi
- Pay alanı + %25 / %50 / %75 / Max hızlı seçim butonları
- "You receive" tahmini, slippage ayarı (varsayılan %1)
- Cüzdan bağlı değilse buton "Sign in" oluyor

### 2. Chart
- **TradingView** kullanılacak
- Line / Candles, zaman aralıkları: 1m, 5m, 1h, 6h, 7D, All
- OHLC + hacim, indikatörler
- Altında istatistik kartları: Market cap, Holders, Trades, Supply, Creator earned, token ve pool adresleri, launch tarihi

### 3. Trades ve Holders sekmeleri
- Trades: yön (Buy/Sell), trader, WETH, token miktarı, fiyat, yaş
- Holders: sıra, holder, tip (Wallet / Contract-Pool), yüzde payı, miktar
- **Karar:** Trades → **subgraph**; Holders → **ayrı indexer + Postgres** ya da graduation sonrası snapshot
  - Gerekçe: Holder listesi her transferde bakiye güncellemesi ve sıralama ister. Bu subgraph'ı şişirir; referanstaki holders yükleme gecikmesi de bundan kaynaklanıyor.

### 4. Analytics sayfası
- 24h / 7d / 30d / All filtreleri
- Volume, Launches, Fees, Protocol revenue
- Zaman serisi grafiği (Volume, Launches, Fees, Revenue, Stock tokens, Stock launches, Buybacks, Burned)
- Son 7 günde trade sayısı, ortalama trade, eşleşmeye göre hacim dağılımı
- Top coins tablosu (30 gün)
- Bunun için de muhtemelen **subgraph** gerekecek (protokol genelinde toplu veriler)

### 5. Cüzdan
- Referansta Reown/WalletConnect modalı var; biz **Privy** kullanacağız
- Sağ üstte "Connect" butonu

### 6. Token oluşturma
- Basit, standart bir altyapı
- 2 adım: **Identity** (görsel, isim, ticker, açıklama, X / Telegram / website) → **Economics**
- Sağda canlı önizleme kartı

### 7. Docs
- Ayrı bir dokümantasyon bölümü

### 8. Profil
- Hem **kullanıcı** hem **creator** için profil sayfası

### 9. Bonding curve matematiği
**Model:** Sanal rezervli constant product (pump.fun tarzı). `x · y = k`
- Fiyat: `p = x / y`
- Alım (`Δe` ETH, fee düşülmüş): `tokenOut = y − k / (x + Δe)`
- Satım (`Δt` token): `ethOut = x − k / (y + Δt)`

**Parametreler (karar):**

| Parametre | Değer |
|---|---|
| Toplam arz | 1.000.000.000 |
| Curve'de satılan | 800M (%80) |
| LP'ye giden | 200M (%20) + toplanan 4.20 ETH |
| Graduation eşiği | 4.20 ETH |
| Sanal ETH `x0` | 1.4 ETH |
| Sanal token `y0` | 1.066.666.667 |
| `k` | ≈ 1.4933 × 10⁹ |
| Başlangıç fiyatı | 1.3125 × 10⁻⁹ ETH (market cap ≈ 1.31 ETH) |
| Graduation fiyatı | 2.1 × 10⁻⁸ ETH (market cap = 21 ETH, başlangıcın 16 katı) |

Parametreler, curve'ün son fiyatı Uniswap v3 açılış fiyatına (4.2 ETH / 200M token) birebir eşit olacak şekilde seçildi. Böylece graduation'da fiyat sıçramaz ve arbitraj fırsatı doğmaz.

**Fee (karar):**
- İşlem fee'si **%1**: **%0.5 protokol**, **%0.5 creator** (2026-11-03'te %0.7/%0.3'ten değişti, rakip analizi sonrası). Fee ETH tarafından kesilir ve rezervlere girmez.
- Graduation fee'si **yok**. Gelir işlem fee'lerinden gelir, fiyat sürekliliği bozulmaz.
- Launch fee: 0.0005 ETH (spam token engeli).

**Graduation (karar):**
- Eşiği aşan son alım kalan tokenla sınırlanır, fazla ETH iade edilir. Graduation aynı tx içinde, atomik olarak yapılır.
- Uniswap v3 **%1 fee tier**, **full-range** pozisyon, `sqrtPriceX96` = curve'ün son fiyatı.
- LP NFT **yakılmaz, kilitlenir**: LP kilit sözleşmesinde kalır, likidite asla çekilemez. Toplanan v3 fee'leri aynı oranla (%50 protokol, %50 creator) dağıtılır. Referanstaki "Creator earned" alanı da bu şekilde çalışıyor.
- Pool'un önceden kurulmasına karşı: pool adresi CREATE2 ile önceden hesaplanır, token sözleşmesi graduation'a kadar bu adrese transferi engeller.

**Güvenlik/uygulama:**
- Yuvarlama her zaman protokol lehine yapılır (alımda token, satımda ETH aşağı yuvarlanır). `mulDiv` kullanılır.
- Kod Foundry ile yazılacak; invariant ve fuzz testleri zorunlu (`k` asla azalmamalı, gerçek ETH rezervi asla negatif olmamalı).

### 10. MEV stratejisi
Robinhood Chain (Arbitrum Orbit) FCFS sıralıyor ve açık mempool yok. Bu yüzden asıl tehdit **sniper botları**; sandwich riski düşük ama yine de korunuyoruz.

**Kararlar:**
1. **Zorunlu slippage + deadline:** Her alım ve satımda `minOut` ve `deadline` zorunlu. Frontend varsayılan slippage %1, sandwich'e karşı temel koruma.
2. **Azalan sniper fee'si:** Launch'tan sonraki ilk **60 saniye** boyunca alım fee'si **%20'den %1'e lineer olarak** düşer. Cüzdan bölerek atlatılamaz, çünkü kural adres başına değil zamana bağlı. Fazla fee protokole ve creator'a aynı oranla gider.
3. **Creator ilk alımı (dev buy):** Creator, token oluşturduğu tx içinde isterse ilk alımı yapabilir, böylece sniper'lardan önce gelir. Bu alıma sniper fee'si uygulanmaz ama üst sınır **%5 (50M token)**.
4. **Atomik graduation:** Pool kurulumu, likidite ekleme ve kilitleme tek tx içinde yapılır, arada araya girilecek bir an yoktur.
5. **Satış her zaman açık:** Sniper fee'si sadece alımlarda uygulanır; satışlar hiçbir zaman engellenmez (honeypot görünümü olmasın).
6. **İzleme:** Indexer, ilk 60 saniyedeki alımları işaretler; frontend'de "sniper" etiketi gösterilebilir (faz 2).

### 11. Sözleşme mimarisi

**Genel ilkeler:**
- Sözleşmeler **upgrade edilemez** (proxy yok). Kullanıcı güveni için: kurallar launch'tan sonra değişmez.
- Token başına parametreler (fee, eşik, sanal rezervler) **launch anında sabitlenir**. Admin yeni parametreleri sadece *yeni* token'lar için değiştirebilir.
- Admin: `Ownable2Step` (multisig, Safe). `Pausable` sadece **yeni launch'ları** durdurur; alım/satım ve claim'ler asla durdurulamaz.
- Ödemeler **pull pattern** ile: fee'ler kasada birikir, sahibi `claim` ile çeker (reentrancy ve başarısız transfer riskini azaltır).
- OpenZeppelin kütüphaneleri, `ReentrancyGuard`, Solidity 0.8.x, Foundry.

**Sözleşmeler:**

| Sözleşme | Görev |
|---|---|
| `LaunchToken` | Sade ERC-20 (1B arz, 18 ondalık). Tüm arz curve'e mint edilir. Graduation'a kadar önceden hesaplanmış Uniswap pool adresine transferi engeller. Owner yok, mint yok, vergi yok. |
| `TokenFactory` | `createToken(name, symbol, metadataURI, devBuyMinOut)` payable. Launch fee'yi alır, token'ı CREATE2 ile deploy eder, curve'e kaydeder, varsa creator'ın dev buy'ını aynı tx'te yapar. |
| `BondingCurve` | **Tek (singleton) sözleşme**, tüm token'ların curve durumunu tutar (her token için ayrı curve deploy etmekten çok daha ucuz). `buy`, `sell`, `quoteBuy`, `quoteSell`. Eşik aşılınca `Graduator`'ı çağırır. |
| `Graduator` | ETH'yi WETH'e çevirir, v3 pool'u doğru fiyatla oluşturur/initialize eder, full-range likidite ekler, LP NFT'sini `LPLocker`'a gönderir. Hepsi tek tx. |
| `LPLocker` | LP NFT'lerini sonsuza kadar tutar; likidite çekme fonksiyonu **yoktur**. `collect(tokenId)` herkes tarafından çağrılabilir, fee'leri `FeeVault`'a %50/%50 böler. |
| `FeeVault` | Protokol ve creator fee'lerinin biriktiği kasa. `claimCreatorFees()`, `withdrawProtocolFees()`. |
| `DCAVault` | Kullanıcı ETH yatırıp plan açar: `createPlan(token, ethPerBuy, interval, count, maxPrice)`. `execute(planId)` zamanı gelince alım yapar: token curve'deyse `BondingCurve`, graduate olduysa Uniswap `SwapRouter02` üzerinden. `cancelPlan` kalan ETH'yi iade eder. |

**`BondingCurve` durum yapısı:**
```solidity
struct Curve {
    uint128 virtualEth;     // x
    uint128 virtualToken;   // y
    uint128 realEth;        // toplanan gerçek ETH
    uint128 tokensSold;     // satılan gerçek token
    address creator;
    uint40  launchTime;     // sniper fee hesabı için
    bool    graduated;
}
mapping(address token => Curve) public curves;
```

**DCA güvenliği (karar):** v1'de `execute` sadece **bizim keeper servisimiz** (whitelist) tarafından çağrılabilir. Neden: permissionless olursa kötü niyetli biri aynı tx içinde önce alıp DCA'yı pahalıya yaptırıp sonra satabilir. Ek koruma: kullanıcının belirlediği `maxPrice`; graduation sonrası Uniswap v3 **TWAP** (5 dk) ile fiyat kontrolü. Faz 2'de permissionless + keeper ödülü.

**Event'ler** (subgraph ve indexer bunlarla beslenecek):
```solidity
event TokenCreated(address indexed token, address indexed creator, string name, string symbol, string metadataURI, uint256 timestamp);
event Trade(address indexed token, address indexed trader, bool isBuy, uint256 ethAmount, uint256 tokenAmount,
            uint256 protocolFee, uint256 creatorFee, uint256 virtualEth, uint256 virtualToken, uint256 realEth, uint256 timestamp);
event Graduated(address indexed token, address indexed pool, uint256 positionId, uint256 ethLiquidity, uint256 tokenLiquidity, uint160 sqrtPriceX96);
event LPFeesCollected(address indexed token, uint256 ethAmount, uint256 tokenAmount);
event CreatorFeesClaimed(address indexed creator, uint256 amount);
event DCAPlanCreated(uint256 indexed planId, address indexed owner, address indexed token, uint256 ethPerBuy, uint256 interval, uint256 count);
event DCAExecuted(uint256 indexed planId, uint256 ethIn, uint256 tokenOut);
event DCAPlanCancelled(uint256 indexed planId, uint256 refund);
```
`Trade` event'i işlem sonrası rezervleri de içerir; böylece subgraph fiyatı ve mumları ek RPC çağrısı olmadan hesaplar.

### 12. Veri katmanı

**Akış:** Sözleşmeler → (Goldsky subgraph + Ponder indexer) → API → Frontend

**Goldsky subgraph (trades + chart + analytics):**
- `BondingCurve.Trade` event'lerini indeksler.
- `Graduated` event'inde, o token'ın Uniswap v3 pool'u için **dinamik data source** (template) açılır; graduation sonrası `Swap` event'leri de aynı `Trade` entity'sine yazılır. Böylece frontend için curve ve Uniswap trade'leri tek liste olur.
- Entity'ler: `Token`, `Trade`, `Candle` (1m, 5m, 1h, 6h, 1d; her trade'de ilgili mum güncellenir), `TokenDayData`, `ProtocolDayData` (hacim, launch sayısı, fee, gelir), `User`.

**Holders indexer — Ponder + Postgres (karar):**
- Ponder: TypeScript ile yazılan, sonuçları doğrudan Postgres'e yazan açık kaynak indexer.
- Factory pattern ile her `LaunchToken`'ın `Transfer` event'lerini dinler, `balances(token, holder, balance)` tablosunu günceller.
- `(token, balance DESC)` indeksi ile sıralama Postgres'te milisaniyeler sürer. Referanstaki "loading holders" gecikmesi olmaz.
- Snapshot yöntemine gerek kalmaz; canlı veri ucuza elde edilir.
- Pool, curve ve locker adresleri "Contract" olarak etiketlenir (referanstaki Type sütunu).

**Off-chain veriler (Postgres + Cloudflare R2):**
- Token görselleri R2'de (S3 uyumlu, çıkış trafiği ücretsiz). Açıklama, sosyal linkler Postgres'te; `metadataURI` bunları gösteren JSON.
- Profiller: Privy kullanıcı ID ↔ cüzdan adresi, kullanıcı adı, avatar.
- Rastgele kullanıcı adları ("PlainBasaltLark" gibi): adresten deterministik üretilir (sıfat + renk + hayvan).

**Chart (karar güncellemesi):** v1'de **TradingView Lightweight Charts** (açık kaynak, Apache 2.0, başvuru gerekmez). Advanced Charts kütüphanesi için TradingView'e başvuru/onay gerekiyor; faz 2'de geçilebilir. Veri subgraph'taki `Candle` entity'sinden gelir; canlı güncelleme için kısa aralıklı polling (v1), WebSocket faz 2.

### 13. Tech stack ve repo yapısı

**Monorepo** (pnpm workspaces + Turborepo):
```
/apps
  /web        → Next.js (App Router) + TypeScript + Tailwind + wagmi/viem + Privy + TanStack Query
  /api        → Hono (Node) — metadata, profil, görsel yükleme, holders sorguları
  /indexer    → Ponder (holders) → Postgres
  /keeper     → DCA keeper servisi (Node, cron ile çalışır)
/packages
  /contracts  → Foundry (Solidity)
  /subgraph   → Goldsky subgraph (AssemblyScript)
  /shared     → ABI'ler, adresler, tipler, curve matematiği (TS)
```
- Curve matematiği `shared` paketinde TS olarak da yazılır; frontend'deki "You receive" tahmini sözleşmeyle **aynı formülü** kullanır. Foundry testleri iki tarafın aynı sonucu verdiğini doğrular.
- Hosting: web → Vercel, api/indexer/keeper → Railway veya Fly.io, Postgres → Neon veya Railway.

### 14. Yol haritası

**Faz 0 — Kurulum (1 hafta)**
- Monorepo, Foundry, Next.js iskeleti, testnet (46630) RPC, Uniswap/WETH adreslerinin explorer'dan doğrulanması.

**Faz 1 — Sözleşmeler (2-3 hafta)**
- `LaunchToken`, `TokenFactory`, `BondingCurve`, `Graduator`, `LPLocker`, `FeeVault`.
- Unit + fuzz + invariant testleri; testnet'te uçtan uca graduation testi (Uniswap v3 fork testi).

**Faz 2 — Veri katmanı (1-2 hafta)**
- Goldsky subgraph (trades, candles, analytics), Ponder holders indexer, API.

**Faz 3 — Frontend v1 (3 hafta)**
- Privy girişi, token sayfası (chart + trade paneli + trades/holders), token oluşturma (2 adım), ana sayfa listesi, profil.

**Faz 4 — DCA + Analytics + Docs (2 hafta)**
- `DCAVault` + keeper, analytics sayfası, docs (Nextra veya Mintlify).

**Faz 5 — Lansman öncesi**
- Bağımsız güvenlik denetimi (audit) — **mainnet'e çıkmadan önce zorunlu**, kullanıcı fonu tutan sözleşmeler var.
- Mainnet deploy, multisig kurulumu, izleme/alarm.

**Faz 2.0 (lansman sonrası):** limit emirler, Advanced Charts, WebSocket canlı veri, permissionless DCA keeper, sniper etiketleri.

## Robinhood Chain araştırması (2026-11-03)

| Konu | Durum | Not |
|---|---|---|
| Zincir | ✅ Mainnet 1 Temmuz 2026'dan beri canlı | Arbitrum Orbit L2, chain ID **4663** (testnet 46630), gas: ETH. RPC: `https://rpc.mainnet.chain.robinhood.com`, explorer: `https://robinhoodchain.blockscout.com` |
| Uniswap v3 | ✅ Var (v2, v3, v4 ve UniswapX de canlı) | Graduation için uygun. ⚠️ Bazı geliştiriciler NonfungiblePositionManager adreslerinde tutarsızlık bildirmiş, adresleri explorer'dan doğrulamak gerekiyor |
| WETH | ✅ `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | 1inch, DexTools ve Spawn aynı adresi veriyor. Hardcode etmeden önce explorer'dan teyit edilmeli |
| Subgraph | ✅ **Goldsky** destekliyor (`robinhood-mainnet`) | The Graph sadece Substreams ile destekliyor, hosted subgraph yok. Ormi Labs alternatif. **→ Goldsky** |
| Privy | 🟡 Preset değil ama çalışır | viem `defineChain` ile custom chain olarak eklenecek |
| Chainlink | 🟡 Data Feeds, Data Streams ve CCIP var | **Automation** için teyit bulunamadı |
| Gelato | ❌ Bulunamadı | |
| Stablecoin | USDG (Paxos) | Referanstaki USDG eşleşmesi bu |

**Sonuçlar:**
- **DCA keeper:** Gelato ve Chainlink Automation teyit edilemediği için büyük ihtimalle **kendi keeper servisimiz** gerekecek. DCA sözleşmesi herkesin tetikleyebileceği (permissionless) şekilde tasarlanmalı, keeper'a küçük bir ödül verilmeli.
- **MEV:** Arbitrum Orbit zincirlerinde sequencer merkezi ve işlemleri FCFS (ilk gelen önce) sıralıyor, açık bir mempool yok. Bu yüzden klasik sandwich riski düşük, asıl risk **sniper botları** (latency yarışı). MEV stratejisi sniper korumasına odaklanmalı. ✅ Doğrulandı: FCFS, Timeboost kapalı, public mempool yok, ~100 ms blok (reports/2026-11-03-sequencer-mev.md).
- **Rakip/alternatif:** Uniswap, Robinhood Chain'de kendi "Liquidity Launchpad"ini açmış. Bunu inceleyip farkımızı netleştirmek lazım.

## Kararlar
- Zincir: **Robinhood Chain**
- Cüzdan: **Privy**
- Chart: **TradingView Lightweight Charts** (v1), Advanced Charts faz 2
- Trades → Goldsky subgraph, Holders → **Ponder + Postgres** (snapshot gerekmez)
- v1: Market + DCA; limit emirler faz 2
- Subgraph sağlayıcı: **Goldsky**
- Graduation hedefi: **Uniswap v3** (Robinhood Chain'de canlı), %1 fee tier, full-range, LP kilitli
- Bonding curve: sanal rezervli constant product, 80/20 bölüşüm, 4.20 ETH eşik
- Fee: %1 (%0.5 protokol / %0.5 creator), graduation fee'si yok
- MEV: zorunlu slippage + 60 sn azalan sniper fee'si + creator dev buy (max %5)
- Sözleşmeler: Solidity + Foundry, upgrade edilemez, admin multisig
- DCA: v1'de kendi keeper servisimiz (whitelist) + `maxPrice` koruması. TWAP, permissionless keeper'a geçerken (faz 2.0) eklenecek.
- Stack: pnpm/Turborepo monorepo — Next.js, Hono, Ponder, Foundry, Goldsky
- Mainnet öncesi bağımsız audit zorunlu (kapsam: reports/audit-scope.md, deploy: reports/deploy-runbook.md)
- Graduation fiyat düzeltme swap'ı bakiyenin en fazla yarısını kullanır (derin likidite DoS'una karşı)
- Deploy adresleri: `packages/shared/deployments/*.json` (tek kaynak)

## Açık sorular
- Faz 2 limit emirler: on-chain mi, off-chain keeper mı?
