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

- [ ] **Faz 3 — Frontend v1** (eklenme: 2026-11-03)
  - Durum: Başlanmadı. Veri kaynakları hazır: subgraph (trades/mumlar/analytics), indexer API (holders, bakiyeler), `packages/shared` (ABI, curve matematiği).
  - Sonraki adım: Privy girişi → token sayfası (Lightweight Charts + trade paneli + trades/holders) → token oluşturma (2 adım) → ana sayfa listesi → profil. Metadata/profil API'si (görsel yükleme R2, kullanıcı adı) da bu fazda.

- [ ] **Goldsky subgraph deploy'u** (eklenme: 2026-11-03)
  - Durum: Subgraph derleniyor; adresler sıfır. Mainnet sözleşme deploy'una ve kullanıcının Goldsky hesabına bağlı.
  - Sonraki adım: Mainnet deploy sonrası `subgraph.yaml` adres/startBlock'larını doldur, `goldsky subgraph deploy` (kullanıcı hesap açınca).

- [ ] **Audit hazırlığı: forge lint uyarıları ve uç durumlar** (eklenme: 2026-11-03)
  - Durum: Faz 1 raporunda listelendi (reports/2026-11-03-faz1-sozlesmeler.md, "Bilinen açık noktalar").
  - Sonraki adım: Faz 5'te uyarıları tek tek kapat veya gerekçelendir; büyük WETH likiditesiyle manipülasyon uç testi ekle.

- [ ] **Chainlink Automation desteğini teyit et** (eklenme: 2026-11-03)
  - Durum: Bulunamadı; v1 kararı kendi keeper'ımız, bu yüzden acil değil.
  - Sonraki adım: Chainlink Automation "Supported Networks" sayfasını kontrol et.

- [ ] **Robinhood sequencer sıralama politikasını doğrula** (eklenme: 2026-11-03)
  - Durum: Arbitrum Orbit varsayımıyla FCFS kabul edildi; MEV stratejisi buna dayanıyor.
  - Sonraki adım: Robinhood Chain dokümanlarında sequencer/ordering bilgisi ara; sonucu reports/'a yaz.

- [ ] **Uniswap Liquidity Launchpad rakip analizi** (eklenme: 2026-11-03)
  - Durum: Varlığı tespit edildi, incelenmedi.
  - Sonraki adım: Özelliklerini incele, farkımızı reports/ altında bir rapora yaz.
