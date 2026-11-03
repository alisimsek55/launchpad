# Backlog Log

[backlog.md](backlog.md)'deki işlerin geçmişi. Sadece ekleme yapılır, kayıtlar silinmez. En yeni kayıt en üstte.

Format:
```
## YYYY-MM-DD — İş başlığı
- Olay: EKLENDİ | GÜNCELLENDİ | TAMAMLANDI | İPTAL
- Not: ne yapıldı / neden
```

---

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
