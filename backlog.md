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

- [ ] **Projeyi kalıcı klasöre taşı** (eklenme: 2026-11-03)
  - Durum: Kod artık GitHub'da (`alisimsek55/launchpad`) güvende, ama yerel çalışma klasörü hâlâ oturumla silinecek geçici klasör. Öneri: OneDrive dışında, örn. `C:\Users\alisi\projects\launchpad`.
  - Sonraki adım: Kullanıcı onay verince oturumu kalıcı klasöre taşı (veya repoyu oraya clone et).

- [ ] **`.env.example` şablonu** (eklenme: 2026-11-03)
  - Durum: `~/.claude/settings.json`'daki `Read(**/.env.*)` deny kuralı nedeniyle Claude oluşturamıyor. Kullanıcı kuralı korumayı seçti.
  - Sonraki adım: Faz 0'da gerçekten gerektiğinde içeriği sohbete yaz, kullanıcı elle oluştursun.

- [ ] **Faz 0 — Kurulum** (eklenme: 2026-11-03)
  - Durum: Başlanmadı; taşıma işine bağlı.
  - Sonraki adım: pnpm + Turborepo monorepo, Foundry, Next.js iskeleti (bkz. notes.md §13-14).

- [ ] **Adresleri explorer'dan doğrula** (eklenme: 2026-11-03)
  - Durum: WETH ve Uniswap v3 adresleri sadece web kaynaklarından alındı. NonfungiblePositionManager adreslerinde tutarsızlık bildirilmiş.
  - Sonraki adım: `https://robinhoodchain.blockscout.com` üzerinde WETH, v3 Factory, NonfungiblePositionManager, SwapRouter02 adreslerini kontrol et; sonucu notes.md'ye yaz.

- [ ] **Chainlink Automation desteğini teyit et** (eklenme: 2026-11-03)
  - Durum: Bulunamadı; v1 kararı kendi keeper'ımız, bu yüzden acil değil.
  - Sonraki adım: Chainlink Automation "Supported Networks" sayfasını kontrol et.

- [ ] **Robinhood sequencer sıralama politikasını doğrula** (eklenme: 2026-11-03)
  - Durum: Arbitrum Orbit varsayımıyla FCFS kabul edildi; MEV stratejisi buna dayanıyor.
  - Sonraki adım: Robinhood Chain dokümanlarında sequencer/ordering bilgisi ara; sonucu reports/'a yaz.

- [ ] **Uniswap Liquidity Launchpad rakip analizi** (eklenme: 2026-11-03)
  - Durum: Varlığı tespit edildi, incelenmedi.
  - Sonraki adım: Özelliklerini incele, farkımızı reports/ altında bir rapora yaz.
