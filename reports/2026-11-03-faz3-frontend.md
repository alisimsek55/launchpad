# Faz 3 Raporu — Frontend v1 (2026-11-03)

## Özet
Next.js 16 ile site yazıldı ve **tarayıcıda uçtan uca test edildi**: anvil mainnet fork'u üzerinde gerçek sözleşmeler, indexer ve metadata API'siyle; curve alım/satım, Uniswap alım/satım (graduation sonrası), token oluşturma (görsel yüklemeyle) ve creator fee claim akışlarının hepsi çalıştı ve zincirdeki sonuçlarla doğrulandı.

## Sayfalar
| Sayfa | İçerik |
|---|---|
| `/` | Token listesi (New / Market cap / Volume), graduation ilerleme çubuğu |
| `/token/[address]` | Fiyat, Lightweight Charts mum grafiği (1m–1D), istatistikler, trades + holders sekmeleri, alım-satım paneli |
| `/create` | 2 adım: Identity (görsel, isim, ticker, açıklama, sosyal) → Economics (dev buy, %5 sınırı canlı gösterilir), canlı önizleme kartı |
| `/profile/[address]` | Deterministik isim/avatar, oluşturduğu tokenlar, tuttuğu tokenlar (ETH değeriyle), creator fee claim + Uniswap LP fee toplama |

## Mimari
- **Cüzdan:** `NEXT_PUBLIC_PRIVY_APP_ID` varsa Privy (+ `@privy-io/wagmi`); yoksa yerelde anvil'in kilidi açık test hesabı (wagmi `mock` connector). İkisi de aynı `WalletUI` arayüzünü sunar.
- **Veri:** `NEXT_PUBLIC_SUBGRAPH_URL` varsa Goldsky subgraph; yoksa (yerel) event'ler doğrudan RPC'den okunur. Holders ve cüzdan bakiyeleri Ponder API'sinden. Her şey 5 sn'de bir tazelenir.
- **Alım-satım:** graduation öncesi `BondingCurve` (`quoteBuy/quoteSell` + slippage + deadline), sonrası Uniswap `SwapRouter02` (alım: `exactInputSingle` + ETH; satım: `multicall[exactInputSingle → unwrapWETH9]` ile doğrudan ETH). Teklif Uniswap'te `QuoterV2`'den.
- **Metadata API (`apps/api`):** `POST /metadata` (multipart): doğrulama (isim/ticker uzunluğu, açıklamada link yasağı, görsel tipi/5 MB), görsel + JSON'u depoya yazar, `metadataURI` döner. Depo: R2 env'leri varsa Cloudflare R2, yoksa yerel disk (`/files/*`).
- **Adresler:** `packages/shared/deployments/{local,mainnet}.json`; `Simulate.s.sol` local'i otomatik yazar.

## Tarayıcı testinde bulunan ve düzeltilen hatalar
1. **Uniswap satışında gas yetmiyordu.** `multicall → WETH.withdraw → router.receive` zincirinde cüzdanın tahmin ettiği gas, iç içe ETH transferi (63/64 kuralı) yüzünden yetersiz kalıp işlem geri döndü. **Gerçek kullanıcıları da etkilerdi.** Tüm yazmalara %20 gas payı eklendi (`useWrite`).
2. **Next 16: `useParams()` Suspense dışında.** Cache Components ile token/profil sayfaları prerender'da hata veriyordu; Suspense ile sarıldı.
3. **Arbitrum'da `block.number` L1 bloğunu döndürüyor.** Simulate yanlış başlangıç bloğu yazıyordu → indexer hiçbir şey görmüyordu. L2 bloğu RPC'den alınıyor. Sözleşmelerimiz `block.number` kullanmıyor (etkilenmiyor).
4. **Indexer yeni token için 404 dönüyordu** (henüz indekslenmemiş) → boş liste döner.

## İlginç bulgu: EIP-7702 sweeper'lar
Uniswap satışından gelen ETH test cüzdanına ulaşmadı. İz kaydı, router'ın ETH'yi doğru adrese gönderdiğini, ama o adresin ETH'yi başka bir sözleşmeye aktardığını gösterdi. Sebep: anvil'in herkese açık test anahtarlarına ait adresler Robinhood mainnet'te **EIP-7702 ile bir "sweeper" sözleşmesine delege edilmiş** (`0xef0100…` kodu); bu adreslere gelen her ETH botlara gidiyor. Fork bu durumu kopyaladığı için yerelde de oldu. Kodumuzda hata yok; `Simulate.s.sol` artık bu adreslerin kodunu yerelde temizliyor. (Ders: herkese açık anahtarları gerçek ağda asla kullanma.)

## Bilinen sınırlamalar / sonraki işler
- **Privy ile gerçek giriş test edilmedi** — Privy hesabı ve app ID gerekiyor (kullanıcı). Kod hazır.
- Yerelde subgraph yok: graduation sonrası Uniswap işlemleri trades listesinde/grafikte görünmez (production'da subgraph gösterir).
- Fiyatlar ETH cinsinden; USD (Chainlink ETH/USD) sonraki iterasyonda.
- Kullanıcı adı düzenleme yok (adresten deterministik isim). Gerekirse API'ye profil tablosu + imzalı istek.
- Analytics ve Docs sayfaları Faz 4'te.
- Anvil'de bloklar yalnızca işlem gelince üretilirse teklif eski zaman damgasıyla hesaplanıp sniper fee'si yüksek görünebilir; `--block-time 1` ile çözülür (README güncellendi). Mainnet'te sorun değil.
