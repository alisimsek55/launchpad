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

- [ ] **Testnet'e ücretsiz yayın: kalan servisler** (eklenme: 2026-11-09)
  - Durum: Sözleşmeler testnet'te (ölçekli parametrelerle, 2026-11-10; adresler testnet.json/const.md). Kalan: Neon (Postgres), Render (indexer), Vercel (web) hesapları ve GitHub'a KEEPER_PRIVATE_KEY secret'ı.
  - Sonraki adım: reports/testnet-deploy.md §3–6; kullanıcı hesapları açınca Echo bağlar ve canlı test yapar.

- [ ] **Tarayıcı cüzdanıyla (MetaMask) gerçek bağlantı testi** (eklenme: 2026-11-09)
  - Durum: `injected` connector + otomatik ağ geçişi kodu hazır; tarayıcı panelinde eklenti olmadığı için yalnızca yerel test cüzdanıyla denendi.
  - Sonraki adım: Testnet yayınından sonra kullanıcının MetaMask'ıyla bağlan → ağ ekleme/geçiş → al/sat.

- [ ] **Faz 2.0 fikirleri** (eklenme: 2026-11-03)
  - Durum: Lansman sonrası.
  - Sonraki adım: DexScreener/GMGN/Bitquery entegrasyonu + açık quote API (yüksek öncelik); fair launch modu (DCA tabanlı); Uniswap v4 graduation; hisse token eşli lansman; limit emirler; permissionless keeper + TWAP; USD fiyatlar; kullanıcı adı düzenleme; README'ye ekran görüntüleri / demo GIF'i.
