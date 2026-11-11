# Backlog

Yarıda kalan ve bekleyen işler. Hiçbir iş yarım bırakılmaz: bırakılan her iş buraya yazılır.
Bir iş bitince buradan silinir ve [backlog-log.md](backlog-log.md)'ye kayıt düşülür.

Format:
```
- [ ] **İş başlığı** (eklenme: YYYY-MM-DD)
  - Durum: nerede kaldı
  - Sonraki adım: devam etmek için ilk yapılacak şey
```

## Açık işler

- [ ] **Faz 2.0 fikirleri** (eklenme: 2026-11-03)
  - Durum: Lansman sonrası.
  - Sonraki adım: GMGN/Bitquery entegrasyonu + açık quote API (yüksek öncelik; DexScreener adapter'ı hazır, bkz. aşağıdaki iş); fair launch modu (DCA tabanlı); Uniswap v4 graduation; hisse token eşli lansman; limit emirler; permissionless keeper + TWAP; kullanıcı adı düzenleme.

- [ ] **DexScreener listeleme başvurusu** (eklenme: 2026-11-10)
  - Durum: Adapter uç noktaları indexer'da hazır (`/dexscreener/*`, README "DexScreener entegrasyonu"). Testnet DexScreener'da listelenmediği için başvuru bekliyor.
  - Sonraki adım: Mainnet deploy'undan sonra mainnet indexer'ın `/dexscreener` adresini DexScreener'a bildir (dış hizmet başvurusu; kullanıcı yapar/onaylar).
  - Not (2026-11-12): Başvurudan önce çöz: indexer v3 "rezerv"leri aktif likiditeden tam aralık formülüyle hesaplıyor (apps/indexer/src/index.ts:~250), üçüncü taraf dar aralıklı likidite gelince yanlış olur; `/dexscreener/events` blok aralığı/satır üst sınırı yok (apps/indexer/src/api/dexscreener.ts:136). Bkz. `reports/2026-11-12-capraz-kontrol-codex.md`.

- [ ] **Çapraz kontrol: sözleşme bulguları (mainnet öncesi)** (eklenme: 2026-11-12)
  - Durum: Codex çapraz kontrolünden ertelenen, redeploy gerektiren bulgular: (1) [High] Graduation gas-DoS: saldırgan fiyat ile hedef arasına çok sayıda initialized tick koyarsa Graduator'ın tek `pool.swap` düzeltmesi blok gas limitini aşabilir (Graduator.sol:74,145); (2) [Medium] const.md 5 dk DCA TWAP diyor ama DCAVault'ta TWAP yok (DCAVault.sol:137,150); (3) [Medium] On-chain `quoteBuy` (BondingCurve.sol:166) fee'yi tüm ethIn'den alıyor ve terminal durumda `>` kullanıyor, `_buy`'dan farklı (TS quote artık birebir); (4) [Low] DCA `maxPrice` graduation iadesinden önceki `ethPerBuy` üzerinden hesaplanıyor, geçerli terminal alım revert olabilir (DCAVault.sol:135,164); (5) [Low] Payable `receive`'i olmayan creator kontratı creator fee çekemez (FeeVault.sol:35,40). Ayrıntı: `reports/2026-11-12-capraz-kontrol-codex.md`.
  - Sonraki adım: Mainnet'ten önce 1 için sınırlı/devam ettirilebilir fiyat düzeltmesi ya da protokol kontrollü havuz tasarla; 2 için `observe()` TWAP ekle ya da const.md'yi düzelt (Faz 2); 3-5'i sonraki redeploy'a al (`claimCreatorFees(recipient)` dahil).

- [ ] **Mainnet kontrol listesi: DCAVault keeper yetkisi** (eklenme: 2026-11-12)
  - Durum: `Deploy.s.sol` `setKeeper` çağırmıyor ve çağıramaz; mainnet'te owner Safe multisig, `setKeeper` `onlyOwner`. Testnet script'i çağırıyor.
  - Sonraki adım: Mainnet deploy'undan sonra Safe'ten `DCAVault.setKeeper(keeper, true)` işlemini gönder; yoksa tüm `execute()` çağrıları `NotKeeper` ile revert eder. Bkz. `reports/deploy-runbook.md`, `reports/2026-11-12-capraz-kontrol-codex.md`.

- [ ] **Keeper ölçeği: plan taraması ve kalıcı backoff** (eklenme: 2026-11-12)
  - Durum: Keeper her turda şimdiye kadarki tüm planları tek multicall ile tarıyor (apps/keeper/src/index.ts:70). 10 dk backoff yalnızca bellekte, `--once` cron çalıştırmaları arasında korunmuyor. Yalnızca plan sayısı çok artınca sorun.
  - Sonraki adım: Sayfalama ya da aktif plan takibi (event/indexer tabanlı) ekle; backoff zamanını kalıcı tut ya da `--once` modunda hatalı planı dışla. Ayrıntı: `reports/2026-11-12-capraz-kontrol-codex.md`.

- [ ] **Çapraz kontrol: subgraph mumları ve metadata gizliliği** (eklenme: 2026-11-12)
  - Durum: (9) [Low] Subgraph mumları spot yerine ortalama işlem fiyatını kullanıyor (packages/subgraph/src/helpers.ts:71,107); paket isteğe bağlı, web kullanmıyor. (10) [Tasarım] Saldırganın kontrol ettiği https metadata/görsel URL'leri ziyaretçi IP'sini ve zamanlamasını o host'a gösteriyor (referrer ve cookie artık kesiliyor).
  - Sonraki adım: 9 için candle open'da işlem öncesi spot, close/high/low'da işlem sonrası spot kullan. 10 için yalnızca zincir üstü `data:` URI'ye izin verilip verilmeyeceğine karar ver. Ayrıntı: `reports/2026-11-12-capraz-kontrol-codex.md`.

- [ ] **Indexer Swap guard'ı uçtan uca doğrula** (eklenme: 2026-11-12)
  - Durum: `UniswapPool:Swap` handler'ı graduation öncesi swap'ları atlıyor (Graduator'ın fiyat düzeltme swap'ı Graduated logundan önce gelir). Yalnızca akıl yürütme ve typecheck ile doğrulandı; anvil ile koşulmadı.
  - Sonraki adım: Anvil fork + `script/Simulate.s.sol` ile graduation'ı çalıştır; düzeltme swap'ının hacim, trade sayısı ve mumlara eklenmediğini kontrol et (README.tr.md "Yerel geliştirme").
