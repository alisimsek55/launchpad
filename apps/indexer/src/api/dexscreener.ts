import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, asc, between, eq, sql } from "ponder";
import { CURVE_SUPPLY, TOTAL_SUPPLY, TRADE_FEE_BPS, getDeployment } from "@launchpad/shared";
import { Hono } from "hono";
import { formatEther, getAddress, isAddress } from "viem";

/// DEX Screener Adapter (spec v1.1): https://dexscreener.notion.site/DEX-Screener-Adapter-Specs-cc1223cdf6e74a7799599106b65dcd0e
///
/// Pair'ler:
/// - Bonding curve: pair id = token adresi (BondingCurve tek kontrat; her token'ın curve'ü token adresiyle tekil).
/// - Graduation sonrası: pair id = Uniswap v3 pool adresi.
/// asset0/asset1, Uniswap kuralıyla sıralanır (küçük adres asset0). Böylece iki pair'de de aynı yön
/// kullanılır ve priceNative = 1 asset0'ın asset1 cinsinden fiyatı olur.
/// Tutarlar ondalıklı string (18 ondalık, kesin); fiyatlar 50 ondalığa kadar kesin bölme.

const d = getDeployment(process.env.LAUNCHPAD_NETWORK);
const WETH = getAddress(d.weth);
const DEAD = "0x000000000000000000000000000000000000dEaD";
const FEE_BPS = Number(TRADE_FEE_BPS); // curve %1, Uniswap pool %1 (10000 fee tier)
const PRICE_DECIMALS = 50;
// /events sınırları (herkese açık uç nokta; tek istekle tüm geçmişi belleğe çekmek DoS olurdu).
// Blok numarası Ponder'ın RPC'den aldığı L2 blok numarasıdır (Solidity'deki block.number gibi L1 değil);
// testnet saniyede ~7 blok ürettiğinden 10.000 blok ≈ 25 dk. DexScreener zincirin ucunu takip ederken
// birkaç blokluk aralıklar sorar. Satır sınırı aşılırsa yanıt kesilmez (kesik yanıt, DexScreener her
// bloğu bir kez sorduğu için kalıcı veri kaybı olurdu); 400 döner ve istemci aralığı daraltır.
const MAX_BLOCK_RANGE = 10_000n;
const MAX_EVENTS = 5_000;

const amount = (wei: bigint) => formatEther(wei);

/// num/den oranını en fazla 50 ondalıklı string'e çevirir (sondaki sıfırlar atılır).
function ratio(num: bigint, den: bigint): string {
  const scaled = (num * 10n ** BigInt(PRICE_DECIMALS)) / den;
  const s = scaled.toString().padStart(PRICE_DECIMALS + 1, "0");
  const int = s.slice(0, -PRICE_DECIMALS);
  const frac = s.slice(-PRICE_DECIMALS).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

const tokenIsAsset0 = (token: string) => BigInt(token) < BigInt(WETH);

/// Ponder'ın son işlediği blok. Checkpoint bloğun ortasındaysa (backfill parça sınırı) o blok henüz
/// tamamlanmamıştır; bir önceki blok döndürülür. DexScreener her bloğu bir kez sorduğu için
/// eksik bir bloğu "hazır" göstermemek gerekir.
async function latestBlock(): Promise<{ blockNumber: number; blockTimestamp: number } | null> {
  const res = await db.execute(sql`SELECT latest_checkpoint FROM _ponder_checkpoint LIMIT 1`);
  const cp = (res.rows[0] as { latest_checkpoint?: string } | undefined)?.latest_checkpoint;
  if (!cp) return null;
  // Format: zaman damgası(10) + chainId(16) + blok(16) + tx index(16) + event tipi(1) + event index(16)
  const blockTimestamp = Number(cp.slice(0, 10));
  const blockNumber = Number(cp.slice(26, 42));
  const blockComplete = cp.slice(42, 58) === "9".repeat(16);
  return { blockNumber: blockComplete ? blockNumber : blockNumber - 1, blockTimestamp };
}

const app = new Hono();

app.get("/latest-block", async (c) => {
  const block = await latestBlock();
  if (!block) return c.json({ error: "indexer not ready" }, 503);
  return c.json({ block });
});

app.get("/asset", async (c) => {
  const id = c.req.query("id");
  if (!id || !isAddress(id)) return c.json({ error: "invalid id" }, 400);
  const address = getAddress(id);
  if (address === WETH) return c.json({ asset: { id: WETH, name: "Wrapped Ether", symbol: "WETH" } });

  const [t] = await db.select().from(schema.token).where(eq(schema.token.address, address)).limit(1);
  if (!t) return c.json({ error: "asset not found" }, 404);
  // Graduation artığı token'lar 0x…dEaD'e yakılır; dolaşımdaki arz bunlar hariç
  const [burn] = await db
    .select()
    .from(schema.balance)
    .where(and(eq(schema.balance.token, address), eq(schema.balance.holder, DEAD)))
    .limit(1);
  return c.json({
    asset: {
      id: address,
      name: t.name,
      symbol: t.symbol,
      totalSupply: amount(TOTAL_SUPPLY),
      circulatingSupply: amount(TOTAL_SUPPLY - (burn?.balance ?? 0n)),
    },
  });
});

app.get("/pair", async (c) => {
  const id = c.req.query("id");
  if (!id || !isAddress(id)) return c.json({ error: "invalid id" }, 400);
  const address = getAddress(id);

  // Bonding curve pair'i (id = token)
  const [t] = await db.select().from(schema.token).where(eq(schema.token.address, address)).limit(1);
  if (t) {
    const [asset0Id, asset1Id] = tokenIsAsset0(t.address) ? [address, WETH] : [WETH, address];
    return c.json({
      pair: {
        id: address,
        dexKey: "launchpad",
        asset0Id,
        asset1Id,
        createdAtBlockNumber: Number(t.createdBlock),
        createdAtBlockTimestamp: Number(t.createdAt),
        createdAtTxnId: t.createdTxHash,
        creator: getAddress(t.creator),
        feeBps: FEE_BPS,
        metadata: { type: "bondingCurve", curveSupply: amount(CURVE_SUPPLY) },
      },
    });
  }

  // Graduation sonrası Uniswap v3 pool'u
  const [p] = await db.select().from(schema.poolToken).where(eq(schema.poolToken.pool, address)).limit(1);
  if (!p) return c.json({ error: "pair not found" }, 404);
  const token = getAddress(p.token);
  const [join] = await db
    .select()
    .from(schema.liquidityEvent)
    .where(and(eq(schema.liquidityEvent.pair, address), eq(schema.liquidityEvent.kind, "join")))
    .limit(1);
  const [asset0Id, asset1Id] = p.tokenIsToken0 ? [token, WETH] : [WETH, token];
  return c.json({
    pair: {
      id: address,
      dexKey: "uniswap",
      asset0Id,
      asset1Id,
      // Pool launch'ta oluşturulur ama graduation'a kadar likiditesizdir; oluşma anı = graduation
      ...(join && {
        createdAtBlockNumber: Number(join.blockNumber),
        createdAtBlockTimestamp: Number(join.timestamp),
        createdAtTxnId: join.txHash,
      }),
      feeBps: FEE_BPS,
      metadata: { type: "uniswapV3", graduatedFrom: token },
    },
  });
});

/// GET /events?fromBlock=&toBlock= (ikisi de dahil)
app.get("/events", async (c) => {
  const fromStr = c.req.query("fromBlock");
  const toStr = c.req.query("toBlock");
  if (!fromStr || !toStr || !/^\d+$/.test(fromStr) || !/^\d+$/.test(toStr)) {
    return c.json({ error: "fromBlock and toBlock are required integers" }, 400);
  }
  const fromBlock = BigInt(fromStr);
  const toBlock = BigInt(toStr);
  if (fromBlock > toBlock) return c.json({ error: "fromBlock > toBlock" }, 400);
  if (toBlock - fromBlock + 1n > MAX_BLOCK_RANGE) {
    return c.json({ error: `block range too large: at most ${MAX_BLOCK_RANGE} blocks per request` }, 400);
  }
  // Henüz indekslenmemiş bloklar istenirse boş dönmek yerine hata ver: DexScreener her bloğu bir kez
  // sorar, eksik veri kalıcı olarak kaçar. Hata alırsa bekleyip tekrar dener.
  const latest = await latestBlock();
  if (!latest || toBlock > BigInt(latest.blockNumber)) {
    return c.json({ error: `toBlock is beyond latest indexed block ${latest?.blockNumber ?? "-"}` }, 400);
  }

  const trades = await db
    .select({ trade: schema.trade, tokenIsToken0: schema.token.tokenIsToken0 })
    .from(schema.trade)
    .innerJoin(schema.token, eq(schema.trade.token, schema.token.address))
    .where(between(schema.trade.blockNumber, fromBlock, toBlock))
    .orderBy(asc(schema.trade.blockNumber), asc(schema.trade.txIndex), asc(schema.trade.logIndex))
    .limit(MAX_EVENTS + 1);
  const liquidity = await db
    .select({ ev: schema.liquidityEvent, tokenIsToken0: schema.token.tokenIsToken0 })
    .from(schema.liquidityEvent)
    .innerJoin(schema.token, eq(schema.liquidityEvent.token, schema.token.address))
    .where(between(schema.liquidityEvent.blockNumber, fromBlock, toBlock))
    .orderBy(asc(schema.liquidityEvent.blockNumber), asc(schema.liquidityEvent.txIndex), asc(schema.liquidityEvent.logIndex))
    .limit(MAX_EVENTS + 1);
  if (trades.length + liquidity.length > MAX_EVENTS) {
    return c.json({ error: `too many events in range (more than ${MAX_EVENTS}); request a smaller block range` }, 400);
  }

  type Sortable = { blockNumber: bigint; txIndex: number; logIndex: number; json: Record<string, unknown> };
  const rows: Sortable[] = [];

  for (const { trade: t, tokenIsToken0 } of trades) {
    const tokenAmt = amount(t.tokenWei);
    const ethAmt = amount(t.ethWei);
    // Alım: ETH girer, token çıkar. Satım: tersi.
    const [inAmt, outAmt] = t.isBuy ? [ethAmt, tokenAmt] : [tokenAmt, ethAmt];
    const inIsAsset0 = t.isBuy ? !tokenIsToken0 : tokenIsToken0;
    rows.push({
      blockNumber: t.blockNumber,
      txIndex: t.txIndex,
      logIndex: t.logIndex,
      json: {
        block: { blockNumber: Number(t.blockNumber), blockTimestamp: Number(t.timestamp) },
        eventType: "swap",
        txnId: t.txHash,
        txnIndex: t.txIndex,
        eventIndex: t.logIndex,
        maker: getAddress(t.trader),
        pairId: getAddress(t.pair),
        ...(inIsAsset0 ? { asset0In: inAmt, asset1Out: outAmt } : { asset1In: inAmt, asset0Out: outAmt }),
        // priceNum/priceDen = token başına ETH. asset0 token ise doğrudan, WETH ise tersi.
        priceNative: tokenIsToken0 ? ratio(t.priceNum, t.priceDen) : ratio(t.priceDen, t.priceNum),
        reserves: tokenIsToken0
          ? { asset0: amount(t.reserveTokenWei), asset1: amount(t.reserveEthWei) }
          : { asset0: amount(t.reserveEthWei), asset1: amount(t.reserveTokenWei) },
        metadata: { source: t.source },
      },
    });
  }

  for (const { ev, tokenIsToken0 } of liquidity) {
    const tok = amount(ev.tokenWei);
    const weth = amount(ev.ethWei);
    rows.push({
      blockNumber: ev.blockNumber,
      txIndex: ev.txIndex,
      logIndex: ev.logIndex,
      json: {
        block: { blockNumber: Number(ev.blockNumber), blockTimestamp: Number(ev.timestamp) },
        eventType: ev.kind,
        txnId: ev.txHash,
        txnIndex: ev.txIndex,
        eventIndex: ev.logIndex,
        maker: getAddress(ev.maker),
        pairId: getAddress(ev.pair),
        amount0: tokenIsToken0 ? tok : weth,
        amount1: tokenIsToken0 ? weth : tok,
        reserves: tokenIsToken0
          ? { asset0: amount(ev.reserveTokenWei), asset1: amount(ev.reserveEthWei) }
          : { asset0: amount(ev.reserveEthWei), asset1: amount(ev.reserveTokenWei) },
      },
    });
  }

  rows.sort((a, b) =>
    a.blockNumber !== b.blockNumber
      ? a.blockNumber < b.blockNumber
        ? -1
        : 1
      : a.txIndex - b.txIndex || a.logIndex - b.logIndex,
  );
  return c.json({ events: rows.map((r) => r.json) });
});

export default app;
