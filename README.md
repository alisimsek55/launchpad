# Launchpad

Robinhood Chain üzerinde bonding curve tabanlı token launchpad. Token'lar curve üzerinde işlem görür, 4.20 ETH eşiğinde Uniswap v3'e graduate olur.

## Dokümanlar
- [notes.md](notes.md) — kararlar, mimari, yol haritası
- [const.md](const.md) — sabitler (chain ID, adresler, parametreler)
- [backlog.md](backlog.md) — açık işler
- [reports/](reports/) — raporlar

## Yapı
```
apps/web            Next.js frontend
apps/api            Hono API
apps/indexer        Ponder holders indexer (Faz 2)
apps/keeper         DCA keeper (Faz 4)
packages/contracts  Solidity + Foundry
packages/shared     Ortak TS: chain tanımları, adresler, curve matematiği
packages/subgraph   Goldsky subgraph (Faz 2)
```

## Gereksinimler
- Node 24+, pnpm 12+
- Foundry (`foundryup`)

## Kurulum
```bash
git clone --recurse-submodules https://github.com/alisimsek55/launchpad.git
cd launchpad
pnpm install
cp env.example .env   # değerleri doldur
```

## Komutlar
```bash
pnpm --filter @launchpad/web dev        # frontend: http://localhost:3000
pnpm --filter @launchpad/api dev        # api: http://localhost:4000/health
pnpm --filter @launchpad/shared test    # curve matematiği testleri
pnpm --filter @launchpad/contracts test # Solidity testleri (mainnet fork, ~3 dk)
pnpm --filter @launchpad/contracts test:fast  # invariant hariç (~15 sn)
pnpm build                              # tüm paketleri derle
```

## Ortam değişkenleri
Gizli anahtarlar `.env` dosyasında tutulur ve `.gitignore` ile repoya girmez. Gizli olmayan sabitler `const.md`'dedir. Şablon: [env.example](env.example).
