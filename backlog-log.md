# Backlog Log

[backlog.md](backlog.md)'deki işlerin geçmişi. Sadece ekleme yapılır, kayıtlar silinmez. En yeni kayıt en üstte.

Format:
```
## YYYY-MM-DD — İş başlığı
- Olay: EKLENDİ | GÜNCELLENDİ | TAMAMLANDI | İPTAL
- Not: ne yapıldı / neden
```

---

## 2026-11-13 — Indexer Render'da çöküyordu (502 no-deploy)
- Olay: TAMAMLANDI
- Not: Public RPC eth_getLogs'ta 100000 blok sınırı koyuyor ve Ponder'ın tanımadığı bir mesajla bildiriyor; otomatik aralık büyümesi sınırı aşınca unhandledRejection ile süreç çıkış kodu 75'le düşüyordu (yerelde birebir yeniden üretildi). `ponder.config.ts`'de `ethGetLogsBlockRange: 100_000` sabitlendi; yerelde backfill 26 sn'de bitti, /ready ve /tokens çalışıyor.

---

## 2026-11-13 — Testnet/mainnet redeploy: çapraz kontrol düzeltmeleri
- Olay: EKLENDİ
- Not: Sözleşme düzeltmeleri kodda; zincirdekiler eski sürüm. `initialize()` tek seferlik olduğundan tüm protokol (Factory, Curve, Locker, Graduator, DCAVault, FeeVault) yeniden deploy edilmeli; ardından deploy JSON'ları, indexer start block'u ve yeni şemayla reindex, ABI üretimi, mainnet'te Safe `setKeeper`. Adımlar: reports/deploy-runbook.md "Sonraki deploy".

## 2026-11-13 — Çapraz kontrol: sözleşme bulguları (mainnet öncesi)
- Olay: TAMAMLANDI
- Not: Kodda çözüldü, redeploy bekliyor (ayrı iş olarak eklendi). (1) Graduation gas-DoS: düzeltme işlem başına en fazla 200 tick geçer, bitmezse `GraduationPending` + herkesin çağırabildiği `continueGraduation` (GraduationDos.t.sol); (2) DCAVault'a 5 dk TWAP koruması (`DCA_TWAP_MAX_DEVIATION_TICKS = 488` ≈ %5; const.md, Constants.sol, packages/shared/src/curve.ts); (3) on-chain `quoteBuy` düzeltildi + `quoteBuyDetailed`; (4) DCA `maxPrice` iade sonrası harcanan ETH üzerinden; (5) `claimCreatorFees(recipient)`, `cancelPlan(id, recipient)`. ABI'ler yeniden üretildi. Web: bekleyen graduation paneli ("Graduation'ı tamamla"), yeni revert hataları için Türkçe mesajlar (apps/web/src/lib/useTx.ts). Indexer: `token.graduationPending` (şema değişti). Keeper: bekleyen graduation'daki planları atlar, TWAP revert'lerini açıklar. Sözleşme testleri 73/73.

## 2026-11-13 — Keeper ölçeği: plan taraması ve kalıcı backoff
- Olay: TAMAMLANDI
- Not: Keeper planları parçalı multicall ile tarıyor (`KEEPER_SCAN_BATCH`), bitmiş planları imleçle atlıyor; backoff ve imleç `.keeper-state.json`'da kalıcı, cron'da actions/cache ile taşınıyor (apps/keeper/src/state.ts, .github/workflows/keeper.yml).

## 2026-11-13 — Çapraz kontrol: subgraph mumları ve metadata gizliliği
- Olay: TAMAMLANDI
- Not: Subgraph mumları işlem öncesi/sonrası spot fiyat kullanıyor (packages/subgraph/src/helpers.ts); web artık yalnız zincir üstü `data:` metadata ve `data:image/(png|jpeg|webp|gif)` görselleri kabul ediyor, https adresleri ziyaretçi IP'si sızdırmasın diye düşüyor (apps/web/src/data/metadata.ts, TokenImage.tsx). `graph build` ile doğrulandı.

## 2026-11-13 — Indexer Swap guard'ı uçtan uca doğrula
- Olay: TAMAMLANDI
- Not: Guard değişmedi (`graduated` yalnız `Graduated` ile true); pool event'leri artık TokenCreated'tan dinleniyor ve graduation öncesi/bekleme sırasındaki düzeltme swap'ları yalnız pool bakiyesini günceller, işlem olarak kaydedilmez. Kalan anvil koşusu redeploy işine eklendi.

## 2026-11-13 — DexScreener listeleme başvurusu
- Olay: GÜNCELLENDİ
- Not: İki kod ön koşulu çözüldü: v3 rezervleri pool'un gerçek bakiyesi (Mint/Collect/Swap/Flash event'lerinden), `/dexscreener/events` istek başına en fazla 10.000 blok ve 5.000 event (aşılırsa 400). Başvuru işi mainnet'i bekliyor.

## 2026-11-12 — Canlı token listesinin yükleme ve hata akışı
- Olay: TAMAMLANDI
- Not: Testnet production build'i için herkese açık Render indexer fallback'i eklendi; token isteği en geç 25 saniyede zaman aşımına uğrayıp açık Türkçe hata ve manuel "Tekrar dene" düğmesi gösteriyor. Böylece eksik env veya erişilemeyen indexer listede süresiz "Yükleniyor…" bırakmıyor.

## 2026-11-12 — Ana sayfa hero bölümü
- Olay: TAMAMLANDI
- Not: Ana sayfaya arka plan görselli hero bölümü eklendi (apps/web/src/components/Hero.tsx, page.tsx). Görsel Codex/gpt-image-2 ile üretildi, 1672×941 WebP'ye (~18 KB) çevrildi: apps/web/public/hero-bg.webp. typecheck/lint/build geçti, masaüstü ve 375 px mobilde görsel kontrol yapıldı. Değişiklikler commit edilmedi.

## 2026-11-12 — Çapraz kontrol (Codex) düzeltmeleri
- Olay: TAMAMLANDI
- Not: Codex (gpt-5.6-sol) projeyi üç şeritte inceledi, Claude bulguları doğruladı, güvenli olanlar düzeltildi (shared `quoteBuy` terminal dalı + 7 test, indexer pre-graduation Swap guard'ı, keeper revert/ayar doğrulaması, web indexer URL/metadata doğrulama/hata durumları), Codex ikinci geçişte APPROVE verdi. 2 bulgu reddedildi, 11 madde ertelendi. Sonuç ve bulgu tablosu: reports/2026-11-12-capraz-kontrol-codex.md. Değişiklikler commit edilmedi.

## 2026-11-12 — Çapraz kontrol: sözleşme bulguları (mainnet öncesi)
- Olay: EKLENDİ
- Not: Graduation gas-DoS, DCA TWAP, on-chain quoteBuy, DCA maxPrice iadesi, creator fee recipient. Redeploy ister; ayrıntı backlog.md ve reports/2026-11-12-capraz-kontrol-codex.md.

## 2026-11-12 — Mainnet kontrol listesi: DCAVault keeper yetkisi
- Olay: EKLENDİ
- Not: Mainnet deploy sonrası Safe'ten `DCAVault.setKeeper(keeper, true)` gerekir; Deploy.s.sol çağıramaz.

## 2026-11-12 — Keeper ölçeği: plan taraması ve kalıcı backoff
- Olay: EKLENDİ
- Not: Tüm planların her turda taranması ve bellekte tutulan backoff; yalnızca ölçekte önemli.

## 2026-11-12 — Çapraz kontrol: subgraph mumları ve metadata gizliliği
- Olay: EKLENDİ
- Not: Subgraph mumları ortalama fiyat kullanıyor; https metadata URL'leri ziyaretçi IP'sini sızdırıyor (yalnız `data:` kararı bekliyor).

## 2026-11-12 — Indexer Swap guard'ı uçtan uca doğrula
- Olay: EKLENDİ
- Not: Guard yalnızca typecheck ve akıl yürütmeyle doğrulandı; anvil + Simulate.s.sol koşusu gerekiyor.

## 2026-11-12 — DexScreener listeleme başvurusu
- Olay: GÜNCELLENDİ
- Not: Çapraz kontrolden iki ön koşul notu eklendi: v3 rezerv hesabı ve `/dexscreener/events` üst sınırı, mainnet başvurusundan önce çözülmeli.

## 2026-11-10 — Türkçe README'yi İngilizceyle eşitle
- Olay: TAMAMLANDI
- Not: README.tr.md, İngilizce README ile aynı yapıya getirildi: rozetler, ekran görüntüsü tablosu, paket/teknoloji tablosu, "Mühendislik notları", "Nasıl geliştirildi". Türkçeye özel ayrıntılı bölümler (yerel geliştirme, DexScreener kararları, demo verisi, komutlar) korundu.

## 2026-11-10 — Portföy vitrini: İngilizce README, ekran görüntüleri, demo GIF'i
- Olay: TAMAMLANDI
- Not: README.md İngilizce yeniden yazıldı (özellik tablosu + ekran görüntüleri, mimari, "Engineering highlights", DEX Screener, yerel çalıştırma, "How it was built"). Türkçe sürüm README.tr.md. Canlı demodan headless Chrome ile docs/screenshots/{home,token,graduated,analytics,create}.jpg + demo.gif (34 kare, 1.9 MB) üretildi; kullanılmayan usd-*.jpg silindi. CLAUDE.md/AGENTS.md README referansları güncellendi. Profil README'si yan oturumda (alisimsek55/alisimsek55).

## 2026-11-10 — Graduated token'da "You receive" teklifi boş
- Olay: TAMAMLANDI
- Not: QuoterV2 zincirde doğru teklif veriyordu (cast + viem simulateContract), sorun wagmi `useSimulateContract`'taydı. Quoter ABI'si `view` olarak tanımlanıp `useReadContract` ile okunuyor (apps/web/src/lib/uniswap.ts, TradePanel.tsx). Yerelde TYGN'de doğrulandı: 0.0001 ETH → 17,832,568 TYGN; 10M TYGN → 0.0000512 ETH.

## 2026-11-10 — Canlı demoyu demo verisiyle doldur
- Olay: TAMAMLANDI
- Not: `apps/keeper/src/seed.ts` (pnpm --filter @launchpad/keeper seed init|run|trade|sweep) yazıldı; anvil fork'ta denendi (DevBuyTooLarge, wei/ETH karışıklığı, satış öncesi approve hataları bulunup düzeltildi). Testnet'te 12 token (SVG logolu, farklı creator'lar) + 30 dk'da 131 işlem (89 alım/42 satış, 0 hata), 8 demo cüzdan. Toplam 13 token, 145 işlem. Demo cüzdanlarının anahtarları apps/keeper/.seed-wallets.json'da (gitignore); kalan ETH ile `seed trade` yeniden çalıştırılabilir. Aynı oturumda USD fiyatları (PR #1) ve DexScreener adapter'ı (PR #2) yan oturumlarda yapılıp merge edildi.

## 2026-11-10 — DexScreener adapter
- Olay: TAMAMLANDI
- Not: Indexer'a DEX Screener Adapter spec v1.1 uç noktaları eklendi (`apps/indexer/src/api/dexscreener.ts`, `/dexscreener/latest-block|asset|pair|events`). `trade` tablosuna blok/tx/log index, kesin spot fiyat ve rezerv sütunları; graduation için `liquidity_event` (exit/join) tablosu. Anvil fork + Simulate (graduation + Uniswap alım/satım) ve testnet verisiyle doğrulandı. README'de "DexScreener entegrasyonu" bölümü.

## 2026-11-10 — DexScreener listeleme başvurusu
- Olay: EKLENDİ
- Not: Testnet DexScreener'da listelenmiyor; başvuru mainnet'e geçince yapılacak.

## 2026-11-10 — Graduated token'da "You receive" teklifi boş
- Olay: EKLENDİ
- Not: USD işi doğrulanırken bulundu; canlı sitede de var (bu değişiklikten bağımsız). Ayrıntı backlog.md'de.

## 2026-11-10 — USD fiyatlar (Faz 2.0 fikirlerinden)
- Olay: TAMAMLANDI
- Not: Web'de ETH tutarlarının yanına USD karşılığı eklendi: token kartları (market cap USD birincil), token sayfası (fiyat, market cap, creator earned), TradePanel (ödenen/alınan ≈ $), trades tablosunda USD sütunu, Analytics, GraduationBar, profil, DCA, token oluşturma, header'da ETH fiyatı. Kaynak Coinbase (yedek CoinGecko), 60 sn önbellek; kaynak düşünce USD gizlenir (yerelde bozuk URL ile doğrulandı). Gerekçe notes.md "Kararlar". typecheck, lint, build geçti.

## 2026-11-10 — Repo herkese açık (public)
- Olay: TAMAMLANDI
- Not: Kullanıcı onayıyla github.com/alisimsek55/launchpad public yapıldı. Öncesinde tüm git geçmişi tarandı (env/keystore/DB adresi/API anahtarı yok; yalnızca anvil'in herkese açık test anahtarı). MIT lisansı eklendi, Solidity SPDX başlıkları MIT'e çevrildi, README'ye CI/lisans rozetleri, repoya açıklama ve konu etiketleri eklendi. test:fast 39/39 geçti.

## 2026-11-10 — Testnet yayını: keeper secret'ı
- Olay: TAMAMLANDI
- Not: KEEPER_PRIVATE_KEY GitHub secret'ı eklendi. İlk çalıştırma MetaMask'ın 0x'siz anahtar formatı yüzünden düştü; keeper artık iki formatı da kabul ediyor. Elle tetiklenen çalıştırma başarılı (keeper 0x986B…0dE0, vault 0x7759…BE24). Cron 30 dk'da bir çalışıyor. Testnet yayını tamamen bitti.

## 2026-11-10 — Tarayıcı cüzdanıyla (MetaMask) gerçek bağlantı testi
- Olay: TAMAMLANDI
- Not: Canlı sitede MetaMask ile uçtan uca: TYGN token'ı oluşturuldu → 0.0042 ETH alım curve'ü doldurup Uniswap v3'e graduation yaptı (tx 0x3328c4f9…a6a4) → 200M token Uniswap'te 0.00209 ETH'ye satıldı (tx 0xa496c0fa…ec3e). Indexer üç olayı da kaydetti; grafik iki mum (yükseliş + satış düşüşü) gösteriyor. Eski Oregon ve başarısız 3aeb Render servisleri silindi.

## 2026-11-10 — Fiyat grafiği: mumlar spot fiyatla
- Olay: TAMAMLANDI
- Not: İlk canlı alım (0.0042 ETH, TYGN graduation yaptı) grafikte düz çizgi göründü: mumlar ortalama işlem fiyatıyla open = close oluyordu. Artık mum işlem öncesi spot fiyattan açılıp işlem sonrası spot fiyatla kapanıyor (apps/indexer/src/index.ts). Testnet verisiyle yerelde doğrulandı: open 1.31e-12 → close 2.1e-11.

## 2026-11-10 — Indexer'ı Frankfurt'ta yeniden oluştur
- Olay: TAMAMLANDI
- Not: Yeni servis https://launchpad-indexer-nzgy.onrender.com (Frankfurt) kullanıcının token'ını indeksledi (tokenCount 1); ölçüm: indexer 11 blok/sn, zincir ~5-7 blok/sn, aradaki fark kapanıyor. const.md ve reports/testnet-deploy.md güncellendi. Blueprint'in "Failed sync" görünmesi, silinen ikinci denemeden kalan launchpad-indexer-3aeb servisinden.

## 2026-11-10 — Testnet yayını: indexer zincire yetişemiyor
- Olay: EKLENDİ
- Not: İlk canlı token (blok 151087032) zincirde oluştu ama sitede görünmedi. Ölçüm: testnet ~6-7 blok/sn, Render (Oregon) indexer ~2 blok/sn → sürekli geride kalıyor. Aynı indexer yerelde 9 blok/sn ve token'ı yakaladı → darboğaz Oregon↔Londra (Neon) gecikmesi. Düzeltme: render.yaml region=frankfurt, Ponder cacheRpcRequests=false. Render bölgesi sonradan değiştirilemediği için servis yeniden oluşturulmalı (kullanıcı adımı), ardından Vercel'de NEXT_PUBLIC_INDEXER_URL güncellenmeli.

## 2026-11-10 — Testnet yayını: keeper secret'ı
- Olay: GÜNCELLENDİ
- Not: Neon (London, free), Render indexer (https://launchpad-indexer-uqhu.onrender.com, /ready 200) ve Vercel web (https://launchpad-cyan-nu.vercel.app) canlıya alındı ve kontrol edildi. render.yaml start komutu POSIX uyumlu yapıldı, buildFilter eklendi. Kalan: keeper secret'ı ve MetaMask ile canlı test.

## 2026-11-10 — Testnet'e ücretsiz yayın: kalan servisler
- Olay: GÜNCELLENDİ
- Not: Cüzdanlar + faucet + keystore tamam. Sözleşmeler testnet'e deploy edildi, ardından graduation'ın demoda görülebilmesi için ETH miktarları 1/1000'e ölçeklenip (Foundry testnet profili, graduation 0.0042 ETH) yeniden deploy edildi; bağlantılar ve parametreler zincirde doğrulandı. Toplam maliyet ~0.0005 test ETH. Web/indexer/docs curve parametrelerini deploy dosyasından okuyor.

## 2026-11-09 — Goldsky subgraph deploy'u
- Olay: İPTAL
- Not: Tüm veri Ponder indexer'a taşındı; subgraph isteğe bağlı olarak repoda duruyor.

## 2026-11-09 — Privy ile gerçek giriş testi
- Olay: İPTAL
- Not: Privy artık isteğe bağlı; varsayılan hesapsız tarayıcı cüzdanı. Yerine "MetaMask bağlantı testi" eklendi.

## 2026-11-09 — Faz 5 — Lansman: kullanıcı adımları
- Olay: İPTAL
- Not: Mainnet + audit planı ücretsiz testnet yayınıyla değiştirildi (yukarıya bkz.). Mainnet rehberi reports/deploy-runbook.md'de duruyor.

## 2026-11-09 — Ücretsiz mimariye geçiş
- Olay: TAMAMLANDI
- Not: Kullanıcının bütçesi yok, proje portföy amaçlı. Mainnet+audit yerine Robinhood testnet; DeployTestnet.s.sol resmi artefaktlardan kendi Uniswap v3'ümüzü kurar (testnet kopyasında deploy+graduation+swap doğrulandı). Hono API + R2 kaldırıldı → metadata zincir üstünde (data: URI, 128px WebP, ~2 KB). Goldsky yerine tek backend Ponder (token/trade/mum/analytics/holders + REST API). Keeper → GitHub Actions cron. Tarayıcı cüzdanı (injected) varsayılan, Privy isteğe bağlı. Render blueprint + Neon. Rapor: reports/2026-11-09-ucretsiz-mimari.md.

## 2026-11-09 — Testnet'e ücretsiz yayın: kullanıcı adımları
- Olay: EKLENDİ
- Not: Rehber: reports/testnet-deploy.md.

## 2026-11-09 — Tarayıcı cüzdanıyla (MetaMask) gerçek bağlantı testi
- Olay: EKLENDİ

## 2026-11-03 — Karar: creator fee payı
- Olay: TAMAMLANDI
- Not: Kullanıcı onayıyla fee bölüşümü %0.7/%0.3 → %0.5 protokol / %0.5 creator (işlem fee'si, sniper fee'si ve Uniswap LP fee'leri). Constants.sol, shared/curve.ts, subgraph, web, docs, const.md, notes.md güncellendi; 40 test geçiyor.

## 2026-11-03 — Faz 2.0 fikirleri
- Olay: EKLENDİ

## 2026-11-03 — Karar: creator fee payı
- Olay: EKLENDİ
- Not: Kullanıcı kararı bekleniyor.

## 2026-11-03 — Uniswap Liquidity Launchpad rakip analizi
- Olay: TAMAMLANDI
- Not: Pools.trade (%0 platform fee, v4) ve Pons (%1) incelendi. Rapor: reports/2026-11-03-rakip-analizi.md.

## 2026-11-03 — Robinhood sequencer sıralama politikasını doğrula
- Olay: TAMAMLANDI
- Not: FCFS, Timeboost kapalı, public mempool yok, ~100 ms blok → MEV varsayımı geçerli. PGA gelebilir, takip edilmeli. Rapor: reports/2026-11-03-sequencer-mev.md.

## 2026-11-03 — Faz 5 — Lansman hazırlığı
- Olay: GÜNCELLENDİ
- Not: Kod tarafı tamamlandı: forge lint 0 uyarı (gerçek düzeltmeler: SafeCast, sıfır adres kontrolleri, init event'leri, CEI sırası, transient storage; kalan bilinçli istisnalar gerekçeli). Manipülasyon fuzz testi gerçek bir DoS buldu (derin WETH likiditesi tüm token'ı tüketip graduation'ı kilitliyordu) → düzeltme swap'ı bakiyenin yarısıyla sınırlandı. CI workflow, reports/audit-scope.md, reports/deploy-runbook.md, deploy dry-run (8.1M gas). Kalanlar kullanıcı hesapları.

## 2026-11-03 — Audit hazırlığı: forge lint uyarıları ve uç durumlar
- Olay: TAMAMLANDI
- Not: Faz 5 kapsamında kapatıldı (yukarıya bkz.).

## 2026-11-03 — Chainlink Automation desteğini teyit et
- Olay: İPTAL
- Not: v1'de kendi keeper'ımız (apps/keeper) yazıldı ve çalışıyor; Chainlink Automation'a gerek kalmadı.

## 2026-11-03 — Faz 5 — Lansman hazırlığı
- Olay: EKLENDİ

## 2026-11-03 — Faz 4 — DCA + Analytics + Docs
- Olay: TAMAMLANDI
- Not: DCAVault (7 test) + keeper + web DCA sekmesi + Analytics + Docs. DCA tarayıcıda uçtan uca test edildi (keeper otomatik alım, iptal/iade). Düzeltmeler: Multicall3 zincir tanımı, Analytics Suspense. TWAP yerine v1'de maxPrice + izinli keeper. Rapor: reports/2026-11-03-faz4-dca-analytics-docs.md.

## 2026-11-03 — Privy ile gerçek giriş testi
- Olay: EKLENDİ
- Not: Kullanıcının Privy hesabı/app ID'si bekleniyor.

## 2026-11-03 — Faz 4 — DCA + Analytics + Docs
- Olay: EKLENDİ

## 2026-11-03 — Faz 3 — Frontend v1
- Olay: TAMAMLANDI
- Not: Ana sayfa, token sayfası (chart, trade paneli curve + Uniswap, trades/holders), 2 adımlı token oluşturma + metadata API (R2/yerel), profil (claim, LP fee). Anvil fork'ta tarayıcıdan uçtan uca test; 4 hata bulunup düzeltildi (Uniswap satış gas'ı, Next 16 Suspense, Arbitrum block.number, indexer 404). Rapor: reports/2026-11-03-faz3-frontend.md.

## 2026-11-03 — Goldsky subgraph deploy'u
- Olay: EKLENDİ
- Not: Mainnet deploy + kullanıcının Goldsky hesabı bekleniyor.

## 2026-11-03 — Faz 3 — Frontend v1
- Olay: EKLENDİ

## 2026-11-03 — Faz 2 — Veri katmanı
- Olay: TAMAMLANDI
- Not: Goldsky subgraph (7 entity, Uniswap pool dinamik data source; graph build geçiyor) + Ponder holders indexer ve API. Anvil fork'ta uçtan uca test: 8 bakiye zincirle birebir. 2 hata bulunup düzeltildi (mint/TokenCreated sırası, fork bloğu sabitleme). Metadata/profil API'si Faz 3'e kaydı. Rapor: reports/2026-11-03-faz2-veri-katmani.md.

## 2026-11-03 — Audit hazırlığı: forge lint uyarıları ve uç durumlar
- Olay: EKLENDİ
- Not: Faz 1'den kalan, kritik olmayan noktalar.

## 2026-11-03 — Faz 2 — Veri katmanı
- Olay: EKLENDİ

## 2026-11-03 — Faz 1 — Sözleşmeler
- Olay: TAMAMLANDI
- Not: LaunchToken, TokenFactory, BondingCurve, Graduator, LPLocker, FeeVault + Deploy script'i. 34 test (unit/fuzz/invariant) mainnet fork'ta geçiyor. Rapor: reports/2026-11-03-faz1-sozlesmeler.md. DCAVault plana göre Faz 4'te.

## 2026-11-03 — Faz 1 — Sözleşmeler
- Olay: EKLENDİ
- Not: Faz 0 bittiği için sıradaki faz backlog'a eklendi.

## 2026-11-03 — Faz 0 — Kurulum
- Olay: TAMAMLANDI
- Not: pnpm 12 + Turborepo monorepo; Foundry 1.9 (forge-std v1.17.0, OpenZeppelin v5.6.1 submodule, solc 0.8.38); `Constants.sol` + 5 unit + 4 mainnet fork testi geçiyor; `packages/shared` (viem chain tanımları, adresler, curve matematiği + 4 vitest testi); Next.js 16 web (build geçiyor); Hono API (`/health` çalışıyor); indexer/keeper/subgraph yer tutucuları. TypeScript 5.9 (Next uyumu için 7 yerine).

## 2026-11-03 — Adresleri explorer'dan doğrula
- Olay: TAMAMLANDI
- Not: Tüm mainnet adresleri resmi kaynaklar + `cast call` ile doğrulandı (const.md). NPM tutarsızlığı bulunmadı. Önemli: USDG 6 ondalıklı; testnet'te Uniswap yok → fork testleri; UniversalRouter adresi kaynaklar arasında tutarsız, kullanılmayacak.

## 2026-11-03 — Projeyi kalıcı klasöre taşı
- Olay: TAMAMLANDI
- Not: Proje `C:\Users\alisi\Documents\launchpad`'e taşındı (OneDrive dışı yerel klasör). Git geçmişi GitHub'dan yeniden bağlandı.

## 2026-11-03 — `.env.example` şablonu
- Olay: TAMAMLANDI
- Not: Şablon `env.example` adıyla oluşturuldu (`.env.*` deny kuralına takılmadan). Gerçek `.env` koruması aynen duruyor. README'ye kopyalama komutu eklendi.

## 2026-11-03 — `.env.example` şablonu
- Olay: EKLENDİ
- Not: Kullanıcının deny kuralı nedeniyle oluşturulamadı; kural güvenlik için korunuyor.

## 2026-11-03 — GitHub `launchpad` reposunu aç ve push et
- Olay: TAMAMLANDI
- Not: Private repo açıldı: https://github.com/alisimsek55/launchpad — ilk commit `main` dalına push edildi.

## 2026-11-03 — GitHub `launchpad` reposunu aç ve push et
- Olay: EKLENDİ
- Not: gh CLI kuruldu, git init + stage yapıldı; GitHub login kullanıcıyı bekliyor.

## 2026-11-03 — Backlog sistemi kuruldu
- Olay: EKLENDİ
- Not: backlog.md'ye 6 açık iş eklendi: klasör taşıma, Faz 0, adres doğrulama, Chainlink Automation teyidi, sequencer politikası, Uniswap Liquidity Launchpad analizi.
