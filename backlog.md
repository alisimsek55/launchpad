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

- [ ] **Faz 2.0 fikirleri** (eklenme: 2026-11-03)
  - Durum: Lansman sonrası.
  - Sonraki adım: GMGN/Bitquery entegrasyonu + açık quote API (yüksek öncelik; DexScreener adapter'ı hazır, bkz. aşağıdaki iş); fair launch modu (DCA tabanlı); Uniswap v4 graduation; hisse token eşli lansman; limit emirler; permissionless keeper + TWAP; USD fiyatlar; kullanıcı adı düzenleme; README'ye ekran görüntüleri / demo GIF'i.

- [ ] **DexScreener listeleme başvurusu** (eklenme: 2026-11-10)
  - Durum: Adapter uç noktaları indexer'da hazır (`/dexscreener/*`, README "DexScreener entegrasyonu"). Testnet DexScreener'da listelenmediği için başvuru bekliyor.
  - Sonraki adım: Mainnet deploy'undan sonra mainnet indexer'ın `/dexscreener` adresini DexScreener'a bildir (dış hizmet başvurusu; kullanıcı yapar/onaylar).
