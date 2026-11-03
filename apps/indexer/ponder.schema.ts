import { index, onchainTable, primaryKey } from "ponder";

export const token = onchainTable("token", (t) => ({
  address: t.hex().primaryKey(),
  pool: t.hex().notNull(),
  creator: t.hex().notNull(),
  createdAt: t.bigint().notNull(),
}));

/// Holder sayısı ayrı tabloda: token'ın mint Transfer'ı aynı tx'te TokenCreated'dan ÖNCE gelir,
/// bu yüzden sayaç token kaydına bağlı olmadan güncellenebilmeli.
export const holderStats = onchainTable("holder_stats", (t) => ({
  token: t.hex().primaryKey(),
  holderCount: t.integer().notNull(),
}));

/// Holder bakiyeleri. (token, balance DESC) indeksi sayesinde sıralı holder listesi milisaniyeler sürer.
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
