# Çapraz Kontrol: Codex İncelemesi (2026-11-12)

## Amaç ve yöntem
Projenin tamamı dış bir gözle (OpenAI Codex, gpt-5.6-sol) üç şeritte (sözleşmeler, backend, web) incelendi; testler de koşturuldu.
1. Codex her şeritte bulgu raporu yazdı (dosya değiştirmedi).
2. Claude her bulguyu kodla doğruladı ve karar verdi: düzelt / reddet / ertele.
3. Doğrulanmış ve güvenli olanlar alt-ajanlarla düzeltildi (değişiklikler çalışma ağacında, commit edilmedi).
4. Codex düzeltmeleri yeniden inceledi: **VERDICT: APPROVE**.

Ham Codex raporları bu dosyaya yapıştırılmadı. Sözleşme kodu değişmedi (ertelenenler redeploy ister).

## Çalıştırılanlar ve sonuçlar
| Komut | Sonuç |
|---|---|
| contracts `test:fast` | 39 geçti |
| contracts `test` (mainnet fork, invariant'lar dahil) | 40 geçti, 0 hata |
| shared test | 6 → 13 geçti (7 yeni `quoteBuy` testi) |
| `pnpm typecheck` | 4/4 başarılı |
| web lint + build | geçti |
| subgraph build | geçti (ilk geçişte) |
| Indexer `Swap` guard'ı için anvil + `Simulate.s.sol` E2E | **koşulmadı** (yalnızca akıl yürütme + typecheck) |

Not: Windows'ta PowerShell yürütme politikası `pnpm.ps1`'i engeller; `pnpm.cmd` kullanıldı.

## Bulgular
| Alan | Önem | Bulgu | Karar | Not |
|---|---|---|---|---|
| Sözleşme | High | Graduation, saldırganın koyduğu çok sayıda tick ile gas limitine takılabilir (Graduator.sol:74,145) | Ertelendi | Sınırlı/devam ettirilebilir fiyat düzeltmesi ya da protokol havuzu gerekir |
| Sözleşme | Medium | const.md 5 dk DCA TWAP diyor, DCAVault'ta TWAP yok (DCAVault.sol:137,150) | Ertelendi | `observe()` TWAP ya da const.md düzeltmesi (Faz 2) |
| Sözleşme | Medium | On-chain `quoteBuy` fee'yi tüm ethIn'den alıyor, terminal durumda `>` kullanıyor (BondingCurve.sol:166) | Ertelendi | Redeploy ister; TS quote artık birebir |
| Sözleşme | Low | DCA `maxPrice` iade öncesi `ethPerBuy` üzerinden hesaplanıyor (DCAVault.sol:135,164) | Ertelendi | Geçerli terminal alım revert olabilir |
| Sözleşme | Low | Payable `receive`'i olmayan creator kontratı fee çekemez (FeeVault.sol:35,40) | Ertelendi | `claimCreatorFees(recipient)` eklenecek |
| Sözleşme | Low | Deploy.s.sol `setKeeper` çağırmıyor | Ertelendi | Mainnet'te owner Safe; deploy sonrası Safe işlemi (kontrol listesi) |
| Backend | High | Keeper her turda tüm plan geçmişini tek multicall ile tarıyor (index.ts:70) | Ertelendi | Sayfalama / aktif plan takibi |
| Backend | Medium | shared `quoteBuy` terminal/graduation dalını (arz sınırı, iade) uygulamıyor (curve.ts:56) | Düzeltildi | `BondingCurve._buy` ile birebir; 7 yeni test (13/13) |
| Backend | Medium | Graduator'ın graduation öncesi düzeltme swap'ı kullanıcı işlemi olarak indeksleniyor | Düzeltildi | `UniswapPool:Swap` graduate olmamış token'ı atlar; Ponder 0.18.4 child logları blok bazında eşler (kaynakta doğrulandı). E2E koşulmadı |
| Backend | Medium | v3 "rezerv" aktif likiditeden tam aralık formülüyle hesaplanıyor (index.ts:~250) | Ertelendi | Dar aralıklı üçüncü taraf likiditede yanlış; DexScreener mainnet'ten önce |
| Backend | Medium | `/dexscreener/events` blok aralığı/satır üst sınırı yok (dexscreener.ts:136) | Ertelendi | Aynı: mainnet listelemesinden önce |
| Backend | Medium | Mined ama revert olan keeper tx'i başarısızlık yoluna girmiyor | Düzeltildi | Revert receipt'i failure/backoff yoluna gider |
| Backend | Medium | Birden çok keeper instance'ı arasında eşzamanlılık kontrolü yok | Reddedildi | Aşağıya bak |
| Backend | Medium | Subgraph mumları spot yerine ortalama fiyat kullanıyor (helpers.ts:71,107) | Ertelendi | Opsiyonel paket, web kullanmıyor |
| Backend | Low | Keeper `POLL_MS` / `SLIPPAGE_BPS` doğrulanmıyor | Düzeltildi | Başlangıçta doğrulanır: POLL_MS 1000–86.400.000, SLIPPAGE_BPS 0–9999 |
| Backend | Low | 10 dk backoff yalnızca bellekte; `--once` cron'da korunmuyor | Ertelendi | Keeper ölçek işiyle birlikte |
| Web | Medium | Eksik/boş `INDEXER_URL` üretimde sessizce bozuyor | Düzeltildi | trim, boş = tanımsız, localhost yalnız local/dev, aksi halde `.invalid` + `INDEXER_URL_MISSING` |
| Web | Medium | Cüzdan bakiye isteğinde HTTP hatası boş sonuç sayılıyor | Düzeltildi | Non-2xx hata fırlatır (useHolders, useWalletBalances) |
| Web | Medium | On-chain metadata yalnızca TS cast'iyle güvenilir sayılıyor | Düzeltildi | Yeni `apps/web/src/data/metadata.ts`: alan tipleri, uzunluk sınırı, yalnız https veya `data:image`, 64 KB gövde sınırı, credentials omit, no-referrer |
| Web | Medium | Saldırgan https metadata/görsel URL'leri ziyaretçi IP'sini sızdırır | Düzeltildi (kısmen) | http:// artık çekilmez; referrer/cookie kesildi. Kalan risk ertelendi |
| Web | Medium | LP-fee toplama döngüsü başarısız tx'ten sonra devam ediyor (ProfileView) | Düzeltildi | İlk başarısız/reddedilen tx'te durur |
| Web | Low | Geçici 429/503 metadata yanıtı sonsuza kadar "fresh" kalıyor | Düzeltildi | Non-2xx hata; `staleTime: Infinity` yalnız `data:` URI için; TokenImage lazy + no-referrer |
| Web | Low | TokenView indexer hatasını "bulunamadı" gösteriyor | Düzeltildi | Hata ve bulunamadı ayrıldı |
| Web | Low | CreateTokenForm karakter sayıyor, kontrat UTF-8 byte | Düzeltildi | Byte uzunluğu doğrulanır (32/10), TokenFactory.sol gibi |

## Reddedilenler
- **Keeper instance'ları arasında eşzamanlılık kontrolü yok:** `.github/workflows/keeper.yml` zaten `concurrency: group: keeper` içeriyor; tek dağıtım şekli cron `--once`.
- **Deploy.s.sol `setKeeper` çağırmalı:** Mainnet'te owner deployer değil Safe multisig; script `onlyOwner` `setKeeper`'ı çağıramaz. Deploy sonrası Safe işlemi olarak mainnet kontrol listesine alındı.

## Ertelenenler
Hepsi `backlog.md`'de izlenir (redeploy, tasarım kararı ya da yalnızca ölçekte/mainnet'te önemli):
1. [High] Graduation gas-DoS (tick şişirme).
2. [Medium] DCA TWAP: uygula ya da const.md'yi düzelt.
3. [Medium] On-chain `quoteBuy` fee/terminal uyumsuzluğu.
4. [Low] DCA `maxPrice` ile graduation iadesi.
5. [Low] Payable olmayan creator fee çekimi.
6. [Mainnet] Deploy sonrası Safe'ten `DCAVault.setKeeper(keeper, true)`.
7. [Ölçek] Keeper tüm planları tarıyor; backoff kalıcı değil.
8. [DexScreener] v3 rezerv hesabı ve `/events` sınırı.
9. [Low] Subgraph mumları ortalama fiyat kullanıyor.
10. [Tasarım] https metadata/görseller host'a IP/zamanlama sızdırır; yalnız `data:` URI'ye mi izin verilsin?
11. [Doğrulama] Indexer Swap guard'ı için anvil fork + `Simulate.s.sol` E2E.
