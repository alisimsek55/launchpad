// forge build çıktısından ABI'leri diğer paketlere aktarır.
//   packages/shared/src/abis.ts   → viem için tipli `as const` ABI'ler (web, api, indexer)
//   packages/subgraph/abis/*.json → subgraph için JSON ABI'ler
// Kullanım: pnpm --filter @launchpad/contracts abis
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const contracts = ["TokenFactory", "BondingCurve", "Graduator", "LPLocker", "FeeVault", "LaunchToken"];

const read = (name) => JSON.parse(readFileSync(join(root, "out", `${name}.sol`, `${name}.json`), "utf8")).abi;

// Uniswap v3 pool Swap event'i (subgraph'ın graduation sonrası işlemleri için)
const uniswapV3Pool = [
  {
    type: "event",
    name: "Swap",
    anonymous: false,
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount0", type: "int256", indexed: false },
      { name: "amount1", type: "int256", indexed: false },
      { name: "sqrtPriceX96", type: "uint160", indexed: false },
      { name: "liquidity", type: "uint128", indexed: false },
      { name: "tick", type: "int24", indexed: false },
    ],
  },
];

const abis = Object.fromEntries(contracts.map((c) => [c, read(c)]));
abis.UniswapV3Pool = uniswapV3Pool;

const ts =
  "// OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: packages/contracts/export-abis.mjs\n\n" +
  Object.entries(abis)
    .map(([name, abi]) => `export const ${name[0].toLowerCase() + name.slice(1)}Abi = ${JSON.stringify(abi, null, 2)} as const;\n`)
    .join("\n");
writeFileSync(join(root, "..", "shared", "src", "abis.ts"), ts);

const subgraphDir = join(root, "..", "subgraph", "abis");
mkdirSync(subgraphDir, { recursive: true });
for (const [name, abi] of Object.entries(abis)) {
  writeFileSync(join(subgraphDir, `${name}.json`), JSON.stringify(abi, null, 2) + "\n");
}
console.log(`ABI'ler aktarıldı: ${Object.keys(abis).join(", ")}`);
