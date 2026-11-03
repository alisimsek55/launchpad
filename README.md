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

## Yerel geliştirme (anvil fork, tüm sistem)
Gerçek ağın yerel kopyasında sözleşmeler + örnek veri + indexer + API + site. Her komut ayrı terminalde:

1. Yerel zincir (1 sn blok süresi, gerçek ağ gibi zaman ilerlesin):
```bash
anvil --fork-url https://rpc.mainnet.chain.robinhood.com --block-time 1
```
2. Deploy + örnek tokenlar (adresleri `packages/shared/deployments/local.json`'a yazar):
```bash
cd packages/contracts && forge script script/Simulate.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --slow
```
3. Indexer (holders), API (görsel/metadata), site:
```bash
cd apps/indexer && rm -rf .ponder && LAUNCHPAD_NETWORK=local npx ponder dev
```
```bash
pnpm --filter @launchpad/api dev
```
```bash
pnpm --filter @launchpad/web dev
```
`http://localhost:3000` → **Connect** yerelde anvil test hesabı #1'i bağlar (Privy app ID yoksa). Yerelde subgraph yok; trades ve chart zincirden okunur (graduation sonrası Uniswap işlemleri listede görünmez).

Indexer uçları: `http://localhost:42069/tokens/<token>/holders`, `/users/<adres>/balances`, `/graphql`.

## Ortam değişkenleri
Gizli anahtarlar `.env` dosyasında tutulur ve `.gitignore` ile repoya girmez. Gizli olmayan sabitler `const.md`'dedir. Şablon: [env.example](env.example).
