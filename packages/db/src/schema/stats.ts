import { mysqlTable, varchar, bigint, int, timestamp, index } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { servers } from "./servers";
import { clients } from "./clients";

export const serverStats = mysqlTable(
  "server_stats",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    serverId: varchar("server_id", { length: 36 }).notNull().references(() => servers.id),
    uptime: bigint("uptime", { mode: "number" }).notNull().default(0),
    connections: int("connections").notNull().default(0),
    bytesIn: bigint("bytes_in", { mode: "number" }).notNull().default(0),
    bytesOut: bigint("bytes_out", { mode: "number" }).notNull().default(0),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
  },
  (table) => ({
    serverIdIdx: index("server_stats_server_id_idx").on(table.serverId),
    timestampIdx: index("server_stats_timestamp_idx").on(table.timestamp),
  })
);

export const serverStatsRelations = relations(serverStats, ({ one }) => ({
  server: one(servers, {
    fields: [serverStats.serverId],
    references: [servers.id],
  }),
}));

export const clientStats = mysqlTable(
  "client_stats",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    clientId: varchar("client_id", { length: 36 }).notNull().references(() => clients.id),
    bytesIn: bigint("bytes_in", { mode: "number" }).notNull().default(0),
    bytesOut: bigint("bytes_out", { mode: "number" }).notNull().default(0),
    lastConnectedAt: timestamp("last_connected_at"),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
  },
  (table) => ({
    clientIdIdx: index("client_stats_client_id_idx").on(table.clientId),
    timestampIdx: index("client_stats_timestamp_idx").on(table.timestamp),
  })
);

export const clientStatsRelations = relations(clientStats, ({ one }) => ({
  client: one(clients, {
    fields: [clientStats.clientId],
    references: [clients.id],
  }),
}));

export type ServerStatsSelect = typeof serverStats.$inferSelect;
export type ServerStatsInsert = typeof serverStats.$inferInsert;
export type ClientStatsSelect = typeof clientStats.$inferSelect;
export type ClientStatsInsert = typeof clientStats.$inferInsert;
