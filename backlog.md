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

- [ ] **Faz 2 — Veri katmanı** (eklenme: 2026-11-03)
  - Durum: Başlanmadı. Sözleşme event'leri hazır (`TokenCreated`, `Trade`, `Graduated`, `LPFeesCollected`, `FeesDeposited`).
  - Sonraki adım: Goldsky subgraph (trades, candles, analytics; graduation sonrası Uniswap `Swap` dinamik data source) → Ponder holders indexer → API uçları (bkz. notes.md §12).

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
