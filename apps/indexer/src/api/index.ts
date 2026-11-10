import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, asc, desc, eq, graphql, gt, gte, sql } from "ponder";
import { getDeployment } from "@launchpad/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { formatEther, getAddress, isAddress } from "viem";
import dexscreener from "./dexscreener";

/// Web'in kullandığı REST API. Tutarlar ETH cinsinden number (görüntüleme), adresler checksum.
const TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;
const DEAD = "0x000000000000000000000000000000000000dEaD";
const d = getDeployment(process.env.LAUNCHPAD_NETWORK);
const eth = (wei: bigint) => Number(formatEther(wei));

// Holder listesinde "Contract" olarak etiketlenecek protokol adresleri
const protocolContracts: Record<string, string> = {};
for (const [label, value] of [
  ["Curve", d.bondingCurve],
  ["Graduator", d.graduator],
  ["LP Locker", d.lpLocker],
  ["DCA Vault", d.dcaVault],
  ["Burn", DEAD],
] as const) {
  protocolContracts[value.toLowerCase()] = label;
}

type TokenRow = typeof schema.token.$inferSelect;
const tokenJson = (t: TokenRow) => ({
  address: getAddress(t.address),
  name: t.name,
  symbol: t.symbol,
  metadataURI: t.metadataURI,
  creator: getAddress(t.creator),
  pool: getAddress(t.pool),
  createdAt: Number(t.createdAt),
  graduated: t.graduated,
  priceEth: t.priceEth,
  marketCapEth: t.priceEth * 1e9,
  volumeEth: eth(t.volumeWei),
  tradeCount: t.tradeCount,
  realEth: eth(t.realEthWei),
  creatorFeesEth: eth(t.creatorFeesWei),
});

const addr = (v: string | undefined) => (v && isAddress(v) ? getAddress(v) : null);
const int = (v: string | undefined, def: number, max: number) => Math.max(0, Math.min(max, Number(v ?? def) || def));

const app = new Hono();
app.use("*", cors());
app.use("/graphql", graphql({ db, schema }));
// DEX Screener Adapter uç noktaları (src/api/dexscreener.ts)
app.route("/dexscreener", dexscreener);

// ---------------------------------------------------------------- tokenlar

/// GET /tokens?sort=new|marketCap|volume&limit=60
app.get("/tokens", async (c) => {
  const sort = c.req.query("sort");
  const order =
    sort === "marketCap" ? desc(schema.token.priceEth) : sort === "volume" ? desc(schema.token.volumeWei) : desc(schema.token.createdAt);
  const rows = await db.select().from(schema.token).orderBy(order).limit(int(c.req.query("limit"), 60, 500));
  return c.json(rows.map(tokenJson));
});

app.get("/tokens/:address", async (c) => {
  const token = addr(c.req.param("address"));
  if (!token) return c.json({ error: "invalid address" }, 400);
  const [row] = await db.select().from(schema.token).where(eq(schema.token.address, token)).limit(1);
  return c.json(row ? tokenJson(row) : null);
});

app.get("/tokens/:address/trades", async (c) => {
  const token = addr(c.req.param("address"));
  if (!token) return c.json({ error: "invalid address" }, 400);
  const rows = await db
    .select()
    .from(schema.trade)
    .where(eq(schema.trade.token, token))
    .orderBy(desc(schema.trade.timestamp))
    .limit(int(c.req.query("limit"), 50, 200));
  return c.json(
    rows.map((t) => ({
      id: t.id,
      token: getAddress(t.token),
      trader: getAddress(t.trader),
      isBuy: t.isBuy,
      ethAmount: eth(t.ethWei),
      tokenAmount: eth(t.tokenWei),
      priceEth: t.priceEth,
      timestamp: Number(t.timestamp),
      txHash: t.txHash,
      source: t.source,
    })),
  );
});

/// GET /tokens/:address/candles?interval=300
app.get("/tokens/:address/candles", async (c) => {
  const token = addr(c.req.param("address"));
  if (!token) return c.json({ error: "invalid address" }, 400);
  const interval = int(c.req.query("interval"), 300, 86400);
  const rows = await db
    .select()
    .from(schema.candle)
    .where(and(eq(schema.candle.token, token), eq(schema.candle.interval, interval)))
    .orderBy(asc(schema.candle.time))
    .limit(1000);
  return c.json(
    rows.map((r) => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close, volumeEth: eth(r.volumeWei) })),
  );
});

/// Sıralı holder listesi: GET /tokens/:address/holders?limit=50&offset=0
app.get("/tokens/:address/holders", async (c) => {
  const token = addr(c.req.param("address"));
  if (!token) return c.json({ error: "invalid address" }, 400);
  const limit = int(c.req.query("limit"), 50, 200);
  const offset = int(c.req.query("offset"), 0, 1_000_000);

  const [info] = await db.select().from(schema.token).where(eq(schema.token.address, token)).limit(1);
  // Yeni token henüz indekslenmemiş olabilir: hata değil, boş liste
  if (!info) return c.json({ token, holderCount: 0, holders: [] });
  const [stats] = await db.select().from(schema.holderStats).where(eq(schema.holderStats.token, token)).limit(1);
  const rows = await db
    .select()
    .from(schema.balance)
    .where(and(eq(schema.balance.token, token), gt(schema.balance.balance, 0n)))
    .orderBy(desc(schema.balance.balance))
    .limit(limit)
    .offset(offset);

  const pool = info.pool.toLowerCase();
  return c.json({
    token,
    holderCount: stats?.holderCount ?? 0,
    holders: rows.map((r, i) => {
      const holder = r.holder.toLowerCase();
      const label = holder === pool ? "Pool" : protocolContracts[holder];
      return {
        rank: offset + i + 1,
        holder: getAddress(r.holder),
        balance: r.balance.toString(),
        sharePct: Number((r.balance * 10_000n) / TOTAL_SUPPLY) / 100,
        type: label ? "Contract" : "Wallet",
        label: label ?? null,
      };
    }),
  });
});

// ---------------------------------------------------------------- kullanıcılar

app.get("/users/:address/tokens", async (c) => {
  const user = addr(c.req.param("address"));
  if (!user) return c.json({ error: "invalid address" }, 400);
  const rows = await db
    .select()
    .from(schema.token)
    .where(eq(schema.token.creator, user))
    .orderBy(desc(schema.token.createdAt));
  return c.json(rows.map(tokenJson));
});

/// Bir cüzdanın tuttuğu token'lar (profil sayfası)
app.get("/users/:address/balances", async (c) => {
  const user = addr(c.req.param("address"));
  if (!user) return c.json({ error: "invalid address" }, 400);
  const rows = await db
    .select()
    .from(schema.balance)
    .where(and(eq(schema.balance.holder, user), gt(schema.balance.balance, 0n)))
    .orderBy(desc(schema.balance.balance));
  return c.json({
    holder: user,
    balances: rows.map((r) => ({ token: getAddress(r.token), balance: r.balance.toString() })),
  });
});

// ---------------------------------------------------------------- protokol / analytics

app.get("/protocol", async (c) => {
  const [p] = await db.select().from(schema.protocolStat).where(eq(schema.protocolStat.id, 1)).limit(1);
  return c.json({
    tokenCount: p?.tokenCount ?? 0,
    graduatedCount: p?.graduatedCount ?? 0,
    tradeCount: p?.tradeCount ?? 0,
    volumeEth: eth(p?.volumeWei ?? 0n),
    feesEth: eth(p?.feesWei ?? 0n),
    protocolRevenueEth: eth(p?.revenueWei ?? 0n),
  });
});

/// GET /protocol/days?since=<unix>
app.get("/protocol/days", async (c) => {
  const since = int(c.req.query("since"), 0, 4_000_000_000) - 86400;
  const rows = await db.select().from(schema.dayStat).where(gte(schema.dayStat.date, since)).orderBy(asc(schema.dayStat.date));
  return c.json(
    rows.map((r) => ({
      date: r.date,
      volumeEth: eth(r.volumeWei),
      feesEth: eth(r.feesWei),
      protocolRevenueEth: eth(r.revenueWei),
      launches: r.launches,
      graduations: r.graduations,
      tradeCount: r.tradeCount,
    })),
  );
});

/// GET /protocol/top?since=<unix>&limit=10 — dönem içinde en çok hacim yapan tokenlar
app.get("/protocol/top", async (c) => {
  const since = Math.floor(int(c.req.query("since"), 0, 4_000_000_000) / 86400) * 86400;
  const rows = await db
    .select({
      token: schema.tokenDay.token,
      volumeWei: sql<string>`sum(${schema.tokenDay.volumeWei})`,
      tradeCount: sql<string>`sum(${schema.tokenDay.tradeCount})`,
    })
    .from(schema.tokenDay)
    .where(gte(schema.tokenDay.date, since))
    .groupBy(schema.tokenDay.token)
    .orderBy(desc(sql`sum(${schema.tokenDay.volumeWei})`))
    .limit(int(c.req.query("limit"), 10, 100));
  return c.json(
    rows.map((r) => ({ token: getAddress(r.token), volumeEth: eth(BigInt(r.volumeWei)), tradeCount: Number(r.tradeCount) })),
  );
});

export default app;
