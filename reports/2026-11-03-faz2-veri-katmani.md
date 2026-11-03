# Faz 2 Raporu — Veri katmanı (2026-11-03)

## Özet
Goldsky subgraph (trades, mumlar, analytics) ve Ponder holders indexer yazıldı. Indexer, anvil mainnet fork'una deploy edilen sözleşmeler üzerinde uçtan uca test edildi; holder bakiyeleri zincirle **birebir** eşleşti.

## Subgraph (`packages/subgraph`)

**Entity'ler:** `Protocol`, `Token`, `Trade`, `Candle`, `TokenDayData`, `ProtocolDayData`, `User`

| Event | İşlem |
|---|---|
| `TokenFactory.TokenCreated` | Token kaydı, launch sayaçları, creator'ın token sayısı |
| `BondingCurve.Trade` | Trade + spot fiyat/market cap + 5 aralıkta mum (1m, 5m, 1h, 6h, 1d) + günlük hacim |
| `Graduator.Graduated` | Token graduated; o token'ın Uniswap pool'u için **dinamik data source** açılır |
| `UniswapV3Pool.Swap` (template) | Graduation sonrası işlemler aynı `Trade`/`Candle` yapısına yazılır (`source: "uniswap"`) |
| `FeeVault.FeesDeposited` | Toplam fee ve protokol geliri (işlem, launch, LP, graduation artığı — tek kaynaktan, çift sayım yok) |
| `LPLocker.LPFeesCollected` | Creator'ın LP fee kazancı ("Creator earned") |

- Frontend chart'ı `Candle` entity'sinden, trades listesi `Trade`'den, analytics sayfası `Protocol` + `ProtocolDayData` + `TokenDayData`'dan beslenecek.
- **Doğrulama:** `graph build` başarılı. Matchstick birim testleri Docker gerektiriyor (makinede yok), bu yüzden mapping'ler test edilmedi. Mainnet deploy'undan sonra Goldsky'de gerçek veriyle kontrol edilecek.
- Adresler ve `startBlock` şimdilik sıfır; deploy sonrası `subgraph.yaml`'a yazılacak.

## Holders indexer (`apps/indexer`, Ponder 0.18)

- Factory pattern: `TokenCreated` ile yeni token'ları otomatik keşfeder, her birinin `Transfer` event'lerini dinler.
- Tablolar: `token`, `holder_stats` (holder sayısı), `balance` (`(token, balance)` indeksli).
- API (Ponder'ın içindeki Hono):
  - `GET /tokens/:address/holders?limit&offset` → sıralı liste; rank, bakiye, yüzde, tip (Wallet/Contract) ve etiket (Curve, Pool, Burn)
  - `GET /users/:address/balances` → cüzdanın tuttuğu token'lar (profil sayfası)
  - `/graphql` → otomatik GraphQL
- Yerelde PGlite (gömülü Postgres), production'da `DATABASE_URL`.

## Uçtan uca test
`script/Simulate.s.sol` anvil fork'unda: deploy + 2 token, 3 cüzdandan alım, satış, cüzdanlar arası transfer ve bir graduation. Indexer'ın döndürdüğü 8 bakiye `cast call balanceOf` ile karşılaştırıldı: **hepsi wei'sine kadar aynı**. Graduate olan token'da pool (%19.99, "Pool") ve yakılan yuvarlama artığı ("Burn") doğru etiketlendi.

## Bulunan ve düzeltilen hatalar
1. **Mint, TokenCreated'dan önce geliyor.** `LaunchToken` constructor'ındaki mint `Transfer`'ı, aynı tx'te `TokenCreated`'dan önce yayınlanıyor. Indexer henüz olmayan token kaydını güncellemeye çalışıp çöktü. Holder sayacı ayrı tabloya (`holder_stats`) taşındı. Birim testleri bunu yakalayamazdı; uçtan uca testin değeri.
2. **Fork bloğu sabitlenemez.** Public RPC arşiv node değil; eski bloğun state'i birkaç saat sonra siliniyor. Testler önbellek sayesinde geçiyordu ama temiz bir makinede kırılacaktı. Fork testleri artık en son bloktan çalışıyor.

## Plandan sapma
- **Metadata/profil API'si (görsel yükleme, kullanıcı adı) Faz 3'e kaydı.** Frontend'le birlikte gerekecek; holders/bakiye uçları ise Ponder'ın kendi API'sinde (ayrı servis gerekmedi).

## Açık noktalar
- Goldsky hesabı ve subgraph deploy'u (mainnet sözleşme deploy'undan sonra) — kullanıcının hesap açması gerekiyor.
- Subgraph mapping testleri (Docker kurulursa matchstick ile).
- Indexer'ın canlı (realtime) modda reorg davranışı anvil'de test edilmedi; Ponder bunu kendisi yönetiyor.
