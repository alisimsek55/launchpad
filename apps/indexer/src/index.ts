import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import { zeroAddress } from "viem";

ponder.on("TokenFactory:TokenCreated", async ({ event, context }) => {
  await context.db.insert(schema.token).values({
    address: event.args.token,
    pool: event.args.pool,
    creator: event.args.creator,
    createdAt: event.block.timestamp,
  });
});

ponder.on("LaunchToken:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;
  if (value === 0n || from === to) return;
  const token = event.log.address;

  // holderCount değişimi: bakiye 0'dan çıkan +1, 0'a inen -1
  let holderDelta = 0;

  if (from !== zeroAddress) {
    const row = await context.db.find(schema.balance, { token, holder: from });
    const next = (row?.balance ?? 0n) - value;
    await context.db
      .insert(schema.balance)
      .values({ token, holder: from, balance: next })
      .onConflictDoUpdate({ balance: next });
    if (next === 0n) holderDelta -= 1;
  }

  const row = await context.db.find(schema.balance, { token, holder: to });
  const prev = row?.balance ?? 0n;
  await context.db
    .insert(schema.balance)
    .values({ token, holder: to, balance: prev + value })
    .onConflictDoUpdate({ balance: prev + value });
  if (prev === 0n) holderDelta += 1;

  if (holderDelta !== 0) {
    await context.db
      .insert(schema.holderStats)
      .values({ token, holderCount: holderDelta })
      .onConflictDoUpdate((row) => ({ holderCount: row.holderCount + holderDelta }));
  }
});
