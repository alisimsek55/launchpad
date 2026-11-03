# Rakip Analizi: Pools.trade (Uniswap), Pons ve diğerleri (2026-11-03)

Kaynaklar sonda. Doğrulanamayan bilgiler işaretli.

## Özet
- **Uniswap Liquidity Launchpad** bir geliştirici altyapısı: CCA (sürekli açık artırma) ve "Instant Launch" stratejileri, Uniswap **v4**. Robinhood Chain'de deploy edilmiş.
- Bunun üstündeki tüketici ürünü **Pools.trade** (Uniswap Labs, 5 Ağu 2026): **platform ücreti %0**, sadece %0.25 LP fee (kilitli likiditeye compound), creator isterse %0.05. İlk gün token sayısında Pons'u geçti (10.506 vs 7.210) ama fee üretimi çok düşük (protokol geliri $0).
- **Pons** (referansımız): %1 fee, token başına bonding curve, graduation'da Uniswap v4, rekor günlük fee ~$6M; PONS token Coinbase'te. Gas muafiyeti bitince günlük gelir ~$2M → ~$240K düştü (doğrulanmadı). Fee bölüşümü kaynaklar arasında çelişkili (bir kaynak %70 creator diyor).
- Nişler: **Long.xyz** ve **Flap** memecoin'leri Robinhood **hisse token'larıyla** eşliyor.

## Karşılaştırma

| | **Biz** | **Pools.trade** | **Pons V2** |
|---|---|---|---|
| Mekanizma | Sanal rezervli curve (%80 curve) | Instant: tek taraflı v4 havuzu; Crowd: 4 saatlik TWAP açık artırma | Token başına curve |
| Graduation | 4.2 ETH → Uniswap v3 %1 | Yok / $10K FDV | Uniswap v4 |
| Platform fee'si | %1 (0.7 protokol / 0.3 creator) | %0 | %1 |
| Creator payı | %0.3 | %0.05 (isteğe bağlı) | Çelişkili (bir kaynak %0.7) |
| Sniper koruması | 60 sn azalan fee (%20→%1) + dev buy %5 | Crowd launch TWAP | Detay yok |
| Ek | DCA, analytics, profil | Uniswap app/wallet/aggregator dağıtımı | PONS buyback/burn |

## Değerlendirme (Echo)

**Rekabet ekseni fiyat değil.** Pools %0 ile hacim çekiyor ama gelir üretmiyor; Pons %1 ile kâr ediyor. Bizim %1 modelimiz Pons'la aynı ve sürdürülebilir. Farkımızı **creator kazancı**, **adil başlangıç** (sniper fee + DCA) ve **ürün kalitesi** üzerinden kurmalıyız.

| Öneri | Karar | Gerekçe |
|---|---|---|
| **Creator payını artır** (ör. 0.5 / 0.5) | ✅ **Uygulandı** (kullanıcı onayı, 2026-11-03) | Creator'lar token'ı tanıtır ve hacim getirir; Pons'un creator'a %70 verdiği iddiası doğruysa %0.3 rekabetçi değil. Önerim **%0.5 protokol / %0.5 creator**: protokol geliri %29 düşer ama creator teşviki 1.67x artar. Kod değişikliği küçük (Constants + testler + docs). |
| Sniper fee fazlasını creator'a/burn'e yönlendir | Hayır | 50/50 ile sniper fee'sinin yarısı zaten creator'a gidiyor. Creator kendi token'ını snipe'larsa %20 öder, %10'unu geri alır: net %10 kayıp, teşvik yok (zaten sniper fee'siz dev buy hakkı var). |
| Graduation'da v4'e geçiş | Faz 2.0'a | v4 hook'larıyla fee yönlendirme daha esnek, ama v3 çalışıyor, test edildi ve auditlenecek. Lansmandan önce değiştirmek risk. Not: başkası aynı token için %0.3 v3 pool açıp akışı bölebilir — bu tüm launchpad'lerde geçerli, kilitli derin likiditemiz avantaj. |
| **Fair launch modu** (DCA altyapısıyla, Crowd Launch'a yanıt) | Faz 2.0 backlog'a | Güçlü farklılaştırıcı ama yeni sözleşme mantığı = yeni audit kapsamı. |
| **Dağıtım:** DexScreener/GMGN/Bitquery entegrasyonu + açık quote/swap API | Lansman sonrası, yüksek öncelik | Curve token'ları aggregator'larda görünmüyor; event'lerimiz (Trade, Graduated) indeksçilerin işini kolaylaştırıyor. |
| **Hisse token'ı eşli lansman** (NVDA/TSLA quote) | Faz 2.0 araştırma | Zincire özgü niş; USDG/hisse token ondalıkları (6) ve curve matematiği yeniden ele alınmalı. |

## Doğrulanamayanlar
Pools'un Crowd Launch'ının CCA olduğu; Pons fee bölüşümü; PONS pazar payı; lansman öncesi $150M hacim; Ekim–Kasım Pools verileri.

## Kaynaklar
- https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/overview.md
- https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/concepts/cca
- https://blog.uniswap.org/pools-trade-a-new-way-to-launch-on-robinhood-chain
- https://thedefiant.io/news/defi/uniswaps-new-launchpad-out-launched-pons-on-its-first-day-on-robinhood-chain
- https://thedefiant.io/news/defi/uniswap-labs-bought-pons-token-for-long-term-alignment
- https://decrypt.co/375031/morning-minute-uniswap-enters-the-launchpad-wars-on-robinhood-chain
- https://defillama.com/protocol/pools
- https://newsletter.defillama.com/p/robinhood-chain-has-a-breakout-app
- https://cryptobriefing.com/pons-record-daily-fees-robinhood-chain/
- https://airdropalert.com/blogs/robinhood-launchpads/
