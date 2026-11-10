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

- [ ] **Indexer'ı Frankfurt'ta yeniden oluştur** (eklenme: 2026-11-10)
  - Durum: Kod düzeltmesi push edildi (region: frankfurt, cacheRpcRequests: false). Render bölgesi sonradan değişmediği için mevcut Oregon servisi silinip Blueprint yeniden uygulanmalı.
  - Sonraki adım: Kullanıcı Render'da eski Blueprint'i silip yenisini oluşturur (DATABASE_URL) → yeni adres Vercel'de NEXT_PUBLIC_INDEXER_URL'e yazılıp redeploy → Echo /status ile zincire yetiştiğini doğrular.

- [ ] **Testnet yayını: keeper secret'ı** (eklenme: 2026-11-09)
  - Durum: Sözleşmeler, indexer (Render+Neon) ve web (Vercel) canlıda: https://launchpad-cyan-nu.vercel.app. Kalan: GitHub'a KEEPER_PRIVATE_KEY secret'ı (DCA keeper cron'u).
  - Sonraki adım: reports/testnet-deploy.md §6; ardından keeper.yml'i elle tetikleyip çalıştığını doğrula.

- [ ] **Tarayıcı cüzdanıyla (MetaMask) gerçek bağlantı testi** (eklenme: 2026-11-09)
  - Durum: `injected` connector + otomatik ağ geçişi kodu hazır; tarayıcı panelinde eklenti olmadığı için yalnızca yerel test cüzdanıyla denendi.
  - Sonraki adım: Testnet yayınından sonra kullanıcının MetaMask'ıyla bağlan → ağ ekleme/geçiş → al/sat.

- [ ] **Faz 2.0 fikirleri** (eklenme: 2026-11-03)
  - Durum: Lansman sonrası.
  - Sonraki adım: DexScreener/GMGN/Bitquery entegrasyonu + açık quote API (yüksek öncelik); fair launch modu (DCA tabanlı); Uniswap v4 graduation; hisse token eşli lansman; limit emirler; permissionless keeper + TWAP; USD fiyatlar; kullanıcı adı düzenleme; README'ye ekran görüntüleri / demo GIF'i.
