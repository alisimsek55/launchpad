# Faz 1 Raporu — Sözleşmeler (2026-11-03)

## Özet
Bonding curve, graduation ve fee altyapısı yazıldı. 34 test (unit + fuzz + invariant) Robinhood Chain mainnet fork'u üzerinde geçiyor. DCA (`DCAVault`) plana uygun olarak Faz 4'te.

## Sözleşmeler (`packages/contracts/src`)

| Sözleşme | Boyut | Görev |
|---|---|---|
| `LaunchToken` | 2.1 KB | Sabit arzlı ERC-20; graduation'a kadar pool'a transfer yasak |
| `TokenFactory` | 6.5 KB | Token + Uniswap pool oluşturur (hedef fiyatla), curve'e kaydeder, dev buy |
| `BondingCurve` | 5.9 KB | Tek sözleşmede tüm curve'ler: buy/sell/quote, sniper fee, graduation tetikleme |
| `Graduator` | 4.6 KB | WETH'e çevirir, gerekirse pool fiyatını düzeltir, full-range LP açar |
| `LPLocker` | 2.3 KB | LP NFT'lerini sonsuza kadar tutar; sadece fee toplar (%70/%30) |
| `FeeVault` | 1.5 KB | Protokol + creator ETH fee kasası (pull pattern) |

Hepsi 24 KB sınırının çok altında. Derleme: solc 0.8.38, via-IR, optimizer 200.

## Tasarım kararları (notes.md'ye ek)

1. **Pool launch anında oluşturulur.** `TokenFactory`, token'ı oluştururken Uniswap pool'unu da hedef graduation fiyatıyla oluşturur ve adresi token'a bildirir. Böylece pool adresini CREATE2 ile tahmin etmeye gerek kalmaz (Robinhood Chain'deki init code hash'ine bağımlılık yok).
2. **Fiyat manipülasyonuna karşı düzeltme swap'ı.** Likiditesiz bir pool'da herkes fiyatı bedavaya oynatabilir. Graduation sırasında fiyat hedeften farklıysa `Graduator` swap ile hedefe geri çeker. Token pool'a transfer edilemediği için saldırgan sadece WETH likiditesi ekleyebilir; bu durumda düzeltme swap'ı token'larımızı **hedeften yüksek** fiyata satar — saldırgan zarar eder, biz kazanırız. Testlerle doğrulandı (yukarı ve aşağı manipülasyon).
3. **Dev buy sınırı gerçekte ~0.07 ETH.** Curve'ün başında fiyat çok düşük: 1 ETH arzın %44'ünü alıyor. %5 (50M token) sınırı ≈ 0.068 ETH'ye denk geliyor. Bu tasarım gereği (pump.fun'da da benzer) ama frontend'de creator'a net gösterilmeli.
4. **Sniper fee'si de %70/%30 bölünür.** Fazla fee creator'a da gidiyor; creator'ın token'ını snipe'lamaya teşviki yok çünkü kendi launch'ında dev buy ile zaten önde.
5. **LP token-tarafı fee'leri:** %70 treasury adresine, %30 creator'a token olarak gönderilir. ETH tarafı FeeVault'a.

## Testler (`packages/contracts/test`)

| Dosya | Kapsam |
|---|---|
| `Constants.t.sol` | Arz/fee bölüşümü, k sabiti, graduation fiyat sürekliliği |
| `Addresses.t.sol` | Uniswap/WETH adreslerinin zincirde birbirine bağlı olduğu |
| `Launch.t.sol` | Token oluşturma, pool fiyatı, launch fee, pause, dev buy + sınır |
| `Trade.t.sol` | TS ile birebir aynı sonuç (parity), fee bölüşümü, sniper fee, slippage/deadline, pool'a transfer yasağı, fuzz: al-sat kâr bırakmaz, herkes çıkabilir |
| `Graduation.t.sol` | Tam graduation, iade, fiyat sürekliliği, Uniswap'te alım-satım, LP fee toplama, manipülasyon düzeltme, fuzz: çok alıcılı graduation |
| `Invariant.t.sol` | Rastgele al-sat dizileri: ETH bakiyesi = rezerv, token muhasebesi, k hiç azalmaz, fiyat başlangıcın altına düşmez |

## Bilinen açık noktalar (audit öncesi)

- **`forge lint` uyarıları** (hata yok): `uint128` cast'leri (değerler sınırlı, güvenli), `block.timestamp` kullanımı (sniper fee için bilinçli), constructor'larda sıfır adres kontrolü yok (deploy script'i doğru adres veriyor), harici çağrıdan sonra event (güvenilir sözleşmeler). Audit'ten önce gözden geçirilmeli.
- **`quoteBuy` eşik aşımında fee'yi yaklaşık döner** (token miktarı doğru, iade hesaba katılmıyor). Sadece UI tahmini için.
- **Graduation düzeltme swap'ı** saldırganın çok büyük WETH likiditesi eklediği uç durumda tüm bakiyeyi harcayıp hedefe ulaşamayabilir; bu durumda bile saldırgan zarar eder. Ek test faz 5'te (audit hazırlığı).
- **Launch maliyeti ~5.3M gas** (çoğu Uniswap pool oluşturma). L2'de ucuz ama frontend'de gas tahmini gösterilmeli.
- **Testnet'te Uniswap olmadığı** için testnet deploy'u graduation'ı test edemez; doğrulama mainnet fork ile yapılıyor.
