/// Demo verisi: canlı demonun boş görünmemesi için testnet'e örnek tokenlar ve işlemler basar.
/// Sadece testnet/local içindir; mainnet'te çalışmayı reddeder.
///
///   pnpm --filter @launchpad/keeper seed init    → demo cüzdanlarını oluşturur (SEED_FILE), fonlayıcı adresini yazar
///   pnpm --filter @launchpad/keeper seed run     → trader'ları fonlar, tokenları oluşturur, DURATION_MIN boyunca işlem yapar
///   pnpm --filter @launchpad/keeper seed trade   → sadece işlem turu (mevcut demo tokenları üzerinde)
///   pnpm --filter @launchpad/keeper seed sweep <adres> → demo cüzdanlarındaki ETH'yi adrese geri gönderir
///
///   SEED_FILE=.seed-wallets.json (gitignore'da)  DURATION_MIN=30  LAUNCHPAD_NETWORK=testnet
///
/// Cüzdanlar rastgele bir mnemonic'ten türetilir: index 0 fonlayıcı, 1..TRADERS trader. Anahtarlar sadece
/// yerel dosyada durur, repoya girmez. Bu cüzdanlar yalnızca değersiz testnet ETH'si tutar.
import { bondingCurveAbi, chainFor, curveParamsOf, getDeployment, launchTokenAbi, tokenFactoryAbi } from "@launchpad/shared";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  maxUint256,
  parseEther,
  parseEventLogs,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { generateMnemonic, english, mnemonicToAccount, type HDAccount } from "viem/accounts";

const deployment = getDeployment(process.env.LAUNCHPAD_NETWORK);
if (deployment.network === "mainnet") throw new Error("Demo verisi mainnet'e basılmaz");
const chain = chainFor(deployment.chainId, process.env.SEED_RPC_URL ?? deployment.rpcUrl);
const publicClient = createPublicClient({ chain, transport: http() });

const SEED_FILE = process.env.SEED_FILE ?? ".seed-wallets.json";
const TRADERS = 8;
const DURATION_MIN = Number(process.env.DURATION_MIN ?? 30);
const { graduationEth: GRADUATION, launchFee: LAUNCH_FEE } = curveParamsOf(deployment); // wei

type SeedState = { mnemonic: string; funded?: boolean; tokens: { address: Address; symbol: string; target: number }[] };

// ---------------------------------------------------------------- demo tokenları
// target: graduation eşiğinin yüzde kaçına kadar doldurulacağı (bütçe ~0.003 ETH kilitli likidite)
const TOKENS: { name: string; symbol: string; description: string; emoji: string; colors: [string, string]; target: number }[] = [
  { name: "Simit Coin", symbol: "SIMIT", description: "Sabah çayının yanına en iyi yatırım. Susamlı, çıtır, deflasyonist.", emoji: "🥯", colors: ["#f59e0b", "#7c2d12"], target: 0.22 },
  { name: "Çay Saati", symbol: "CAY", description: "İnce belli bardakta topluluk tokenı. Demlenmesi biraz sürer.", emoji: "🍵", colors: ["#dc2626", "#450a0a"], target: 0.14 },
  { name: "Rocket Hamster", symbol: "HMSTR", description: "Tekerlekte koşmayı bıraktı, aya gidiyor.", emoji: "🐹", colors: ["#fb923c", "#1e1b4b"], target: 0.09 },
  { name: "Boğaz Köprüsü", symbol: "BOGAZ", description: "İki kıtayı, iki zinciri birleştiren token.", emoji: "🌉", colors: ["#0ea5e9", "#0c4a6e"], target: 0.07 },
  { name: "Pixel Pug", symbol: "PUG", description: "8-bit bir pug. Havlaması bile piksel piksel.", emoji: "🐶", colors: ["#a78bfa", "#2e1065"], target: 0.05 },
  { name: "Gece Kuşu", symbol: "BAYKUS", description: "Gece 3'te kod yazanların resmi tokenı.", emoji: "🦉", colors: ["#6366f1", "#020617"], target: 0.04 },
  { name: "Turbo Turtle", symbol: "TRTL", description: "Yavaş ama emin adımlarla. Turbo modu açık.", emoji: "🐢", colors: ["#22c55e", "#052e16"], target: 0.03 },
  { name: "Lucky Lahmacun", symbol: "LHMC", description: "İnce hamur, kalın topluluk. Limon dahil.", emoji: "🍋", colors: ["#facc15", "#713f12"], target: 0.025 },
  { name: "Neon Fox", symbol: "NFOX", description: "Synthwave ormanından gelen kurnaz tilki.", emoji: "🦊", colors: ["#f472b6", "#3b0764"], target: 0.02 },
  { name: "Kahve Molası", symbol: "KAHVE", description: "Türk kahvesi kadar sade, falı kadar belirsiz.", emoji: "☕", colors: ["#a16207", "#1c1917"], target: 0.015 },
  { name: "Moon Martı", symbol: "MARTI", description: "Simitçiyi takip eden martı şimdi Ay'ı takip ediyor.", emoji: "🕊️", colors: ["#e2e8f0", "#334155"], target: 0.01 },
  { name: "Diamond Kedi", symbol: "DKEDI", description: "Elmas patiler asla satmaz. İstanbul sokaklarından.", emoji: "🐱", colors: ["#2dd4bf", "#134e4a"], target: 0.01 },
];

/// Küçük, zincir üstüne yazmaya uygun SVG logo (gradyan + emoji + sembol)
function logo(t: (typeof TOKENS)[number]): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.colors[0]}"/><stop offset="1" stop-color="${t.colors[1]}"/></linearGradient></defs>` +
    `<rect width="128" height="128" fill="url(#g)"/>` +
    `<text x="64" y="74" font-size="58" text-anchor="middle">${t.emoji}</text>` +
    `<text x="64" y="114" font-size="17" font-weight="700" font-family="Arial,sans-serif" fill="#fff" text-anchor="middle">$${t.symbol}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function metadataURI(t: (typeof TOKENS)[number]): string {
  const json = JSON.stringify({ name: t.name, symbol: t.symbol, description: t.description, image: logo(t) });
  return `data:application/json;base64,${Buffer.from(json).toString("base64")}`;
}

// ---------------------------------------------------------------- yardımcılar

const load = (): SeedState => JSON.parse(readFileSync(SEED_FILE, "utf8"));
const save = (s: SeedState) => writeFileSync(SEED_FILE, JSON.stringify(s, null, 2));
const account = (s: SeedState, i: number): HDAccount => mnemonicToAccount(s.mnemonic, { addressIndex: i });
const walletOf = (a: HDAccount) => createWalletClient({ chain, account: a, transport: http() });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;
const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 600);
const eth = (n: number) => parseEther(n.toFixed(9));

type Call = { address: Address; abi: Abi; functionName: string; args: readonly unknown[]; value?: bigint };

async function send(a: HDAccount, tx: Call) {
  // Script içi sabit çağrılar; viem'in ABI'ye göre daraltılmış genel tipine gerek yok
  const hash = await walletOf(a).writeContract(tx as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`tx başarısız: ${hash}`);
  return receipt;
}

async function realEthOf(token: Address): Promise<bigint> {
  // curves(token) public getter'ı tuple döner: [virtualEth, virtualToken, realEth, tokensSold, creator, launchTime, graduated]
  const c = await publicClient.readContract({
    address: deployment.bondingCurve,
    abi: bondingCurveAbi,
    functionName: "curves",
    args: [token],
  });
  return c[2];
}

// ---------------------------------------------------------------- komutlar

async function init() {
  if (!existsSync(SEED_FILE)) save({ mnemonic: generateMnemonic(english), tokens: [] });
  const s = load();
  const funder = account(s, 0);
  const bal = await publicClient.getBalance({ address: funder.address });
  console.log(`Fonlayıcı: ${funder.address} (bakiye ${formatEther(bal)} ETH)`);
}

async function fund(s: SeedState) {
  const funder = account(s, 0);
  const total = await publicClient.getBalance({ address: funder.address });
  // Fonlayıcı token oluşturma gas'ı + launch fee'leri için ~%15 tutar, gerisini trader'lara böler
  const each = ((total * 85n) / 100n) / BigInt(TRADERS);
  console.log(`Fonlayıcı ${formatEther(total)} ETH → her trader'a ${formatEther(each)} ETH`);
  for (let i = 1; i <= TRADERS; i++) {
    const to = account(s, i).address;
    const hash = await walletOf(funder).sendTransaction({ to, value: each });
    await publicClient.waitForTransactionReceipt({ hash });
  }
}

async function launch(s: SeedState) {
  for (const [i, t] of TOKENS.entries()) {
    if (s.tokens.some((x) => x.symbol === t.symbol)) continue;
    const creator = account(s, 1 + (i % TRADERS));
    const devBuy = eth(rand(0.00001, 0.00004)); // testnet MAX_DEV_BUY (%5 arz) ≈ 0.00007 ETH
    const receipt = await send(creator, {
      address: deployment.tokenFactory,
      abi: tokenFactoryAbi,
      functionName: "createToken",
      args: [t.name, t.symbol, metadataURI(t), 0n],
      value: LAUNCH_FEE + devBuy,
    });
    const [created] = parseEventLogs({ abi: tokenFactoryAbi, logs: receipt.logs, eventName: "TokenCreated" });
    if (!created) throw new Error("TokenCreated event'i bulunamadı");
    s.tokens.push({ address: created.args.token, symbol: t.symbol, target: t.target });
    save(s);
    console.log(`✓ ${t.symbol} ${created.args.token} (creator ${creator.address.slice(0, 8)})`);
    await sleep(rand(3_000, 10_000));
  }
}

async function trade(s: SeedState) {
  const traders = Array.from({ length: TRADERS }, (_, i) => account(s, i + 1));
  const end = Date.now() + DURATION_MIN * 60_000;
  let n = 0;
  console.log(`İşlem turu: ${DURATION_MIN} dk, ${s.tokens.length} token`);
  while (Date.now() < end) {
    // Hedefi büyük tokenlar daha sık işlem görsün
    const weights = s.tokens.map((t) => Math.sqrt(t.target));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    const t = s.tokens[weights.findIndex((w) => (r -= w) <= 0)] ?? s.tokens[0]!;
    const trader = pick(traders);
    try {
      const progress = Number(await realEthOf(t.address)) / Number(GRADUATION);
      const held = (await publicClient.readContract({
        address: t.address,
        abi: launchTokenAbi,
        functionName: "balanceOf",
        args: [trader.address],
      })) as bigint;
      // Hedefin altındaysa çoğunlukla al, üstündeyse çoğunlukla sat
      const buyChance = progress < t.target ? 0.72 : 0.25;
      const ethBal = await publicClient.getBalance({ address: trader.address });
      if ((Math.random() < buyChance || held === 0n) && ethBal > eth(0.00008)) {
        const amount = eth(rand(0.00001, Math.min(0.00012, Number(formatEther(ethBal)) * 0.25)));
        await send(trader, {
          address: deployment.bondingCurve,
          abi: bondingCurveAbi,
          functionName: "buy",
          args: [t.address, 0n, deadline(), trader.address],
          value: amount,
        });
        console.log(`${++n}. BUY  ${t.symbol.padEnd(6)} ${formatEther(amount)} ETH  (ilerleme %${(progress * 100).toFixed(1)})`);
      } else if (held > 0n) {
        const amount = (held * BigInt(Math.floor(rand(20, 70)))) / 100n;
        const allowance = (await publicClient.readContract({
          address: t.address,
          abi: launchTokenAbi,
          functionName: "allowance",
          args: [trader.address, deployment.bondingCurve],
        })) as bigint;
        if (allowance < amount) {
          await send(trader, {
            address: t.address,
            abi: launchTokenAbi,
            functionName: "approve",
            args: [deployment.bondingCurve, maxUint256],
          });
        }
        await send(trader, {
          address: deployment.bondingCurve,
          abi: bondingCurveAbi,
          functionName: "sell",
          args: [t.address, amount, 0n, deadline(), trader.address],
        });
        console.log(`${++n}. SELL ${t.symbol.padEnd(6)} %${((Number(amount) / Number(held)) * 100).toFixed(0)} pozisyon`);
      }
    } catch (e) {
      console.warn(`atlandı (${t.symbol}): ${(e as Error).message.split("\n")[0]}`);
    }
    await sleep(rand(3_000, 15_000));
  }
}

async function sweep(s: SeedState, to: Address) {
  for (let i = 0; i <= TRADERS; i++) {
    const a = account(s, i);
    const bal = await publicClient.getBalance({ address: a.address });
    const gas = 21_000n * ((await publicClient.getGasPrice()) * 2n);
    if (bal <= gas) continue;
    const hash = await walletOf(a).sendTransaction({ to, value: bal - gas, gas: 21_000n });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`${a.address} → ${formatEther(bal - gas)} ETH`);
  }
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "init") await init();
else if (cmd === "run") {
  const s = load();
  if (!s.funded) {
    await fund(s);
    s.funded = true;
    save(s);
  }
  await launch(s);
  console.log("Sniper fee penceresi (60 sn) bekleniyor…");
  await sleep(65_000);
  await trade(s);
} else if (cmd === "trade") await trade(load());
else if (cmd === "sweep" && arg) await sweep(load(), arg as Hex);
else console.log("Kullanım: seed init | run | trade | sweep <adres>");
