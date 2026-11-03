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

- [ ] **Faz 5 — Lansman: kullanıcı adımları** (eklenme: 2026-11-03)
  - Durum: Kod tarafı hazır (lint temiz, manipülasyon DoS'u düzeltildi, CI, audit kapsamı, deploy runbook, deploy dry-run başarılı). Kalanlar kullanıcıya ait: audit firması, Safe multisig, deployer/keeper cüzdanları, Alchemy, Privy, Goldsky, R2, hosting hesapları.
  - Sonraki adım: `reports/deploy-runbook.md` §0–1'deki [SEN] adımları. Hesaplar açılınca Echo §2–6'yı yürütür.

- [ ] **Privy ile gerçek giriş testi** (eklenme: 2026-11-03)
  - Durum: Kod hazır (`apps/web/src/wallet/PrivyProviders.tsx`); app ID olmadan test edilemedi.
  - Sonraki adım: Kullanıcı privy.io'da hesap + app açıp App ID'yi `.env`'ye (`NEXT_PUBLIC_PRIVY_APP_ID`) yazınca giriş/embedded wallet akışını test et.

- [ ] **Goldsky subgraph deploy'u** (eklenme: 2026-11-03)
  - Durum: Subgraph derleniyor; adresler sıfır. Mainnet sözleşme deploy'una ve kullanıcının Goldsky hesabına bağlı.
  - Sonraki adım: Mainnet deploy sonrası `subgraph.yaml` adres/startBlock'larını doldur, `goldsky subgraph deploy` (kullanıcı hesap açınca).

- [ ] **Karar: creator fee payı** (eklenme: 2026-11-03)
  - Durum: Rakip analizi (reports/2026-11-03-rakip-analizi.md) creator payının (%0.3) rekabetçi olmayabileceğini gösterdi. Echo önerisi: %0.5 protokol / %0.5 creator. İş modeli kararı, kullanıcıda.
  - Sonraki adım: Kullanıcı onaylarsa Constants.sol + shared/curve.ts + testler + const.md + docs güncellenir (mainnet deploy öncesi).

- [ ] **Faz 2.0 fikirleri** (eklenme: 2026-11-03)
  - Durum: Lansman sonrası.
  - Sonraki adım: DexScreener/GMGN/Bitquery entegrasyonu + açık quote API (yüksek öncelik); fair launch modu (DCA tabanlı); Uniswap v4 graduation; hisse token eşli lansman; limit emirler; permissionless keeper + TWAP; USD fiyatlar; kullanıcı adı düzenleme.
