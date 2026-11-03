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
apps/indexer        Ponder: holders indexer + holders API
apps/keeper         DCA keeper (Faz 4)
packages/contracts  Solidity + Foundry
packages/shared     Ortak TS: chain tanımları, adresler, curve matematiği, ABI'ler
packages/subgraph   Goldsky subgraph: trades, mumlar, analytics
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
pnpm --filter @launchpad/contracts abis # sözleşme değişince ABI'leri shared + subgraph'a aktar
pnpm --filter @launchpad/subgraph build # subgraph'ı derle
pnpm build                              # tüm paketleri derle
```

## Yerel uçtan uca test (anvil fork)
Sözleşmeleri gerçek ağın yerel kopyasına deploy edip indexer'ı ona bağlar:
```bash
anvil --fork-url https://rpc.mainnet.chain.robinhood.com
```
```bash
cd packages/contracts && forge script script/Simulate.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --slow
```
Script'in yazdırdığı adreslerle indexer'ı başlat (`START_BLOCK` = deploy'dan hemen önceki blok):
```bash
cd apps/indexer && TOKEN_FACTORY_ADDRESS=0x... BONDING_CURVE_ADDRESS=0x... GRADUATOR_ADDRESS=0x... START_BLOCK=... PONDER_RPC_URL_4663=http://127.0.0.1:8545 npx ponder dev
```
Holders: `http://localhost:42069/tokens/<token>/holders`, cüzdan: `/users/<adres>/balances`, GraphQL: `/graphql`.

## Ortam değişkenleri
Gizli anahtarlar `.env` dosyasında tutulur ve `.gitignore` ile repoya girmez. Gizli olmayan sabitler `const.md`'dedir. Şablon: [env.example](env.example).
