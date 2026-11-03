# Audit Kapsam Dokümanı

Bağımsız güvenlik denetimi (audit) firmasına verilecek özet. Mainnet'e çıkmadan önce zorunlu: sözleşmeler kullanıcı ETH'si tutuyor.

## Kapsam (`packages/contracts/src`, ~760 nSLOC)

| Dosya | nSLOC | Not |
|---|---|---|
| `BondingCurve.sol` | 226 | Tüm curve'ler (singleton): buy/sell, sniper fee, eşik aşımı iadesi, graduation tetikleme |
| `DCAVault.sol` | 149 | Periyodik alım; izinli keeper; curve veya Uniswap |
| `Graduator.sol` | 105 | Fiyat düzeltme swap'ı + Uniswap v3 full-range LP |
| `LPLocker.sol` | 78 | LP NFT kilidi, fee toplama/dağıtma |
| `TokenFactory.sol` | 73 | Token + pool oluşturma, dev buy |
| `FeeVault.sol` | 38 | Pull-pattern fee kasası |
| `LaunchToken.sol` | 34 | ERC-20; graduation'a kadar pool'a transfer yasak |
| `Constants.sol` | 31 | Parametreler ve mainnet adresleri |
| `libraries/PriceMath.sol` | 16 | Hedef sqrtPriceX96, sniper fee eğrisi |

Kapsam dışı: `interfaces/`, `script/`, `test/`, OpenZeppelin v5.6.1, Uniswap v3.

- Derleyici: solc 0.8.38, via-IR, optimizer 200, EVM `cancun` (transient storage kullanılıyor).
- Ağ: Robinhood Chain (Arbitrum Orbit, chain ID 4663).

## Mimari özeti
Bkz. `notes.md` §9–11 ve `reports/2026-11-03-faz1-sozlesmeler.md`.

## Korunması gereken değişmezler (invariant)
1. Graduation öncesi `BondingCurve` ETH bakiyesi = tüm token'ların `realEth` toplamı (fee'ler anında FeeVault'a gider).
2. Her token için `virtualEth * virtualToken` hiçbir işlemde azalmaz (yuvarlama curve lehine).
3. `tokensSold ≤ 800M`; graduation öncesi curve'ün token bakiyesi = `1B − tokensSold`.
4. Herkes token'ını her an curve'e geri satabilir (curve ödeme gücünü kaybetmez).
5. Al-sat turu kâr bırakmaz.
6. Graduation hiçbir koşulda kalıcı olarak engellenemez (DoS yok); pool fiyatı hedefin (token aleyhine) altına inmez.
7. LP NFT LPLocker'dan çıkamaz, likidite çekilemez.
8. Pause sadece yeni launch'ları durdurur; alım/satım, claim, DCA iptali her zaman çalışır.
9. DCA: plan sahibi dışında kimse planın ETH'sine dokunamaz; `maxPrice` her zaman uygulanır.

1–5 invariant/fuzz testleriyle, 6 fuzz (`Manipulation.t.sol`, 0.5–100 ETH saldırgan likiditesi), diğerleri birim testlerle kapsanıyor. Toplam 40 test, Robinhood mainnet fork'unda.

## Güven varsayımları
- **Owner (Safe multisig):** yeni launch'ları durdurabilir, protokol fee'lerini çekebilir, DCA keeper'larını atayabilir. Kullanıcı fonlarına, curve parametrelerine, LP'ye dokunamaz.
- **DCA keeper (v1, izinli):** sadece zamanı gelen planı çalıştırabilir; `minTokensOut` keeper'dan gelir ama kullanıcının `maxPrice`'ı zincirde ayrıca uygulanır. Kötü niyetli keeper en kötü ihtimalle maxPrice'a kadar kötü fiyattan alım yaptırabilir (maxPrice=0 seçen kullanıcı için slippage riski).
- **Uniswap v3** (Factory/NPM/SwapRouter02) ve **WETH** (proxy) güvenilir kabul ediliyor.
- **Sequencer:** Arbitrum Orbit FCFS sıralama varsayıldı; sandwich koruması zorunlu slippage + deadline ile.

## Bilinen ve kabul edilen noktalar
- `block.timestamp` sniper fee eğrisi ve deadline için kullanılıyor (saniye düzeyi sapma önemsiz).
- Graduation'da `amount0Min/amount1Min = 0`: fiyat aynı tx'te ayarlandığı için araya girilemez.
- Çok derin saldırgan WETH likiditesinde pool fiyatı hedefin üstünde kalabilir (token lehine); saldırgan zarar eder, piyasa düzeltir.
- `quoteBuy`, eşik aşımında fee'yi yaklaşık döner (sadece UI).
- Arbitrum'da `block.number` L1 bloğudur; sözleşmeler kullanmıyor.
- `forge lint` temiz; bilinçli istisnalar satır içinde `forge-lint: disable` + gerekçe ile işaretli.

## Denetçiye özellikle sorulacaklar
1. `Graduator._movePrice` + full-range mint: manipüle edilmiş pool'da değer sızıntısı veya DoS kalıyor mu?
2. `BondingCurve._buy` eşik aşımı hesabı (`gross`, `refund`) yuvarlama uç durumları.
3. `LaunchToken._update` pool engeli: pool'a dolaylı token sokmanın başka yolu var mı (ör. Uniswap `flash`, başka fee tier pool'u)?
4. DCA iade muhasebesi (`refunded` hesabı) ve reentrancy.
5. Sniper fee + dev buy etkileşimi.
