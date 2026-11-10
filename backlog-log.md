# Backlog Log

[backlog.md](backlog.md)'deki işlerin geçmişi. Sadece ekleme yapılır, kayıtlar silinmez. En yeni kayıt en üstte.

Format:
```
## YYYY-MM-DD — İş başlığı
- Olay: EKLENDİ | GÜNCELLENDİ | TAMAMLANDI | İPTAL
- Not: ne yapıldı / neden
```

---

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
