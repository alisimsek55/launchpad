import { index, onchainTable, primaryKey } from "ponder";

// Tutarlar wei cinsinden bigint (kesin); fiyatlar görüntüleme için double (token başına ETH).

export const token = onchainTable(
  "token",
  (t) => ({
    address: t.hex().primaryKey(),
    name: t.text().notNull(),
    symbol: t.text().notNull(),
    metadataURI: t.text().notNull(),
    creator: t.hex().notNull(),
    pool: t.hex().notNull(),
    tokenIsToken0: t.boolean().notNull(),
    createdAt: t.bigint().notNull(),
    graduated: t.boolean().notNull(),
    priceEth: t.doublePrecision().notNull(),
    volumeWei: t.bigint().notNull(),
    tradeCount: t.integer().notNull(),
    realEthWei: t.bigint().notNull(),
    creatorFeesWei: t.bigint().notNull(),
  }),
  (table) => ({
    byCreator: index().on(table.creator),
    byCreatedAt: index().on(table.createdAt),
    byVolume: index().on(table.volumeWei),
  }),
);

/// Graduation sonrası Uniswap Swap event'inden token'a ulaşmak için
export const poolToken = onchainTable("pool_token", (t) => ({
  pool: t.hex().primaryKey(),
  token: t.hex().notNull(),
  tokenIsToken0: t.boolean().notNull(),
}));

export const trade = onchainTable(
  "trade",
  (t) => ({
    id: t.text().primaryKey(),
    token: t.hex().notNull(),
    trader: t.hex().notNull(),
    isBuy: t.boolean().notNull(),
    ethWei: t.bigint().notNull(),
    tokenWei: t.bigint().notNull(),
    priceEth: t.doublePrecision().notNull(),
    timestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    source: t.text().notNull(), // curve | uniswap
  }),
  (table) => ({
    byTokenTime: index().on(table.token, table.timestamp),
  }),
);

/// OHLCV mumları; interval saniye (60, 300, 3600, 21600, 86400)
export const candle = onchainTable(
  "candle",
  (t) => ({
    token: t.hex().notNull(),
    interval: t.integer().notNull(),
    time: t.integer().notNull(),
    open: t.doublePrecision().notNull(),
    high: t.doublePrecision().notNull(),
    low: t.doublePrecision().notNull(),
    close: t.doublePrecision().notNull(),
    volumeWei: t.bigint().notNull(),
  }),
  (table) => ({ pk: primaryKey({ columns: [table.token, table.interval, table.time] }) }),
);

/// Protokol toplamları (tek satır, id = 1)
export const protocolStat = onchainTable("protocol_stat", (t) => ({
  id: t.integer().primaryKey(),
  tokenCount: t.integer().notNull(),
  graduatedCount: t.integer().notNull(),
  tradeCount: t.integer().notNull(),
  volumeWei: t.bigint().notNull(),
  feesWei: t.bigint().notNull(),
  revenueWei: t.bigint().notNull(),
}));

export const dayStat = onchainTable("day_stat", (t) => ({
  date: t.integer().primaryKey(), // günün başlangıcı (unix sn)
  volumeWei: t.bigint().notNull(),
  feesWei: t.bigint().notNull(),
  revenueWei: t.bigint().notNull(),
  launches: t.integer().notNull(),
  graduations: t.integer().notNull(),
  tradeCount: t.integer().notNull(),
}));

export const tokenDay = onchainTable(
  "token_day",
  (t) => ({
    token: t.hex().notNull(),
    date: t.integer().notNull(),
    volumeWei: t.bigint().notNull(),
    tradeCount: t.integer().notNull(),
  }),
  (table) => ({ pk: primaryKey({ columns: [table.token, table.date] }) }),
);

/// Holder sayısı ayrı tabloda: token'ın mint Transfer'ı aynı tx'te TokenCreated'dan ÖNCE gelir,
/// bu yüzden sayaç token kaydına bağlı olmadan güncellenebilmeli.
export const holderStats = onchainTable("holder_stats", (t) => ({
  token: t.hex().primaryKey(),
  holderCount: t.integer().notNull(),
}));

/// Holder bakiyeleri. (token, balance) indeksi sayesinde sıralı holder listesi milisaniyeler sürer.
export const balance = onchainTable(
  "balance",
  (t) => ({
    token: t.hex().notNull(),
    holder: t.hex().notNull(),
    balance: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.token, table.holder] }),
    byTokenBalance: index().on(table.token, table.balance),
    byHolder: index().on(table.holder),
  }),
);
