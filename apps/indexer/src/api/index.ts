import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, desc, eq, graphql, gt } from "ponder";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getDeployment } from "@launchpad/shared";
import { getAddress, isAddress } from "viem";

const TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;
const DEAD = "0x000000000000000000000000000000000000dEaD";
const deployment = getDeployment(process.env.LAUNCHPAD_NETWORK);

// Holder listesinde "Contract" olarak etiketlenecek protokol adresleri
const protocolContracts: Record<string, string> = {};
for (const [label, value] of [
  ["Curve", process.env.BONDING_CURVE_ADDRESS ?? deployment.bondingCurve],
  ["Graduator", process.env.GRADUATOR_ADDRESS ?? deployment.graduator],
  ["LP Locker", deployment.lpLocker],
  ["Burn", DEAD],
] as const) {
  if (value && isAddress(value)) protocolContracts[value.toLowerCase()] = label;
}

const app = new Hono();
app.use("*", cors());
app.use("/graphql", graphql({ db, schema }));

/// Sıralı holder listesi: GET /tokens/:address/holders?limit=50&offset=0
app.get("/tokens/:address/holders", async (c) => {
  const address = c.req.param("address");
  if (!isAddress(address)) return c.json({ error: "invalid address" }, 400);
  const token = getAddress(address);
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

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
        holder: r.holder,
        balance: r.balance.toString(),
        // yüzde, 2 ondalık hassasiyetle (bps * 100)
        sharePct: Number((r.balance * 10_000n) / TOTAL_SUPPLY) / 100,
        type: label ? "Contract" : "Wallet",
        label: label ?? null,
      };
    }),
  });
});

/// Bir cüzdanın tuttuğu token'lar (profil sayfası): GET /users/:address/balances
app.get("/users/:address/balances", async (c) => {
  const address = c.req.param("address");
  if (!isAddress(address)) return c.json({ error: "invalid address" }, 400);
  const rows = await db
    .select()
    .from(schema.balance)
    .where(and(eq(schema.balance.holder, getAddress(address)), gt(schema.balance.balance, 0n)))
    .orderBy(desc(schema.balance.balance));
  return c.json({
    holder: getAddress(address),
    balances: rows.map((r) => ({ token: r.token, balance: r.balance.toString() })),
  });
});

export default app;
