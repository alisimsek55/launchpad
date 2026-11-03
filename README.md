# Launchpad

Robinhood Chain üzerinde bonding curve tabanlı token launchpad. Token'lar curve üzerinde işlem görür, 4.20 ETH eşiğinde Uniswap v3'e graduate olur.

## Dokümanlar
- [notes.md](notes.md) — kararlar, mimari, yol haritası
- [const.md](const.md) — sabitler (chain ID, adresler, parametreler)
- [backlog.md](backlog.md) — açık işler
- [reports/](reports/) — raporlar

## Ortam değişkenleri
Gizli anahtarlar `.env` dosyasında tutulur ve `.gitignore` ile repoya girmez. Gizli olmayan sabitler `const.md`'dedir.

Şablon: [env.example](env.example) — `.env` adıyla kopyalayıp değerleri doldur:
```bash
cp env.example .env
```
