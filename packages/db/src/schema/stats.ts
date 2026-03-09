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

// Traffic snapshots for charts (from Hysteria2 /traffic, saved periodically)
export const trafficSnapshots = mysqlTable(
  "traffic_snapshots",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    clientId: varchar("client_id", { length: 36 }).notNull().references(() => clients.id),
    tx: bigint("tx", { mode: "number" }).notNull().default(0),
    rx: bigint("rx", { mode: "number" }).notNull().default(0),
    sampledAt: timestamp("sampled_at").notNull().defaultNow(),
  },
  (table) => ({
    clientIdIdx: index("traffic_snapshots_client_id_idx").on(table.clientId),
    sampledAtIdx: index("traffic_snapshots_sampled_at_idx").on(table.sampledAt),
  })
);

export const trafficSnapshotsRelations = relations(trafficSnapshots, ({ one }) => ({
  client: one(clients, {
    fields: [trafficSnapshots.clientId],
    references: [clients.id],
  }),
}));

// Live traffic throughput (from streams, aggregate up/down bytes per sec)
export const liveTrafficSnapshots = mysqlTable(
  "live_traffic_snapshots",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    upBytesPerSec: bigint("up_bytes_per_sec", { mode: "number" }).notNull().default(0),
    downBytesPerSec: bigint("down_bytes_per_sec", { mode: "number" }).notNull().default(0),
    sampledAt: timestamp("sampled_at").notNull().defaultNow(),
  },
  (table) => ({
    sampledAtIdx: index("live_traffic_snapshots_sampled_at_idx").on(table.sampledAt),
  })
);

// State for computing live traffic delta (single row, id='default')
export const liveTrafficState = mysqlTable("live_traffic_state", {
  id: varchar("id", { length: 36 }).primaryKey(),
  lastTotalTx: bigint("last_total_tx", { mode: "number" }).notNull().default(0),
  lastTotalRx: bigint("last_total_rx", { mode: "number" }).notNull().default(0),
  lastSampledAt: timestamp("last_sampled_at").notNull().defaultNow(),
});

// Stream snapshots (from /dump/streams, saved periodically)
export const streamSnapshots = mysqlTable(
  "stream_snapshots",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    serverId: varchar("server_id", { length: 36 }).notNull(),
    serverName: varchar("server_name", { length: 255 }).notNull(),
    auth: varchar("auth", { length: 255 }).notNull(),
    reqAddr: varchar("req_addr", { length: 512 }).notNull(),
    tx: bigint("tx", { mode: "number" }).notNull().default(0),
    rx: bigint("rx", { mode: "number" }).notNull().default(0),
    initialAt: varchar("initial_at", { length: 64 }),
    lastActiveAt: varchar("last_active_at", { length: 64 }),
    sampledAt: timestamp("sampled_at").notNull().defaultNow(),
  },
  (table) => ({
    sampledAtIdx: index("stream_snapshots_sampled_at_idx").on(table.sampledAt),
    serverIdIdx: index("stream_snapshots_server_id_idx").on(table.serverId),
  })
);

export type ServerStatsSelect = typeof serverStats.$inferSelect;
export type ServerStatsInsert = typeof serverStats.$inferInsert;
export type ClientStatsSelect = typeof clientStats.$inferSelect;
export type ClientStatsInsert = typeof clientStats.$inferInsert;
export type TrafficSnapshotSelect = typeof trafficSnapshots.$inferSelect;
export type TrafficSnapshotInsert = typeof trafficSnapshots.$inferInsert;
export type LiveTrafficSnapshotSelect = typeof liveTrafficSnapshots.$inferSelect;
export type LiveTrafficSnapshotInsert = typeof liveTrafficSnapshots.$inferInsert;
export type StreamSnapshotSelect = typeof streamSnapshots.$inferSelect;
export type StreamSnapshotInsert = typeof streamSnapshots.$inferInsert;
