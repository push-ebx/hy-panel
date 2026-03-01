import { mysqlTable, varchar, bigint, timestamp, boolean } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { servers } from "./servers";
import { clientStats } from "./stats";

export const clients = mysqlTable("clients", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  serverId: varchar("server_id", { length: 36 }).notNull().references(() => servers.id),
  name: varchar("name", { length: 255 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  uploadLimit: bigint("upload_limit", { mode: "number" }).notNull().default(0),
  downloadLimit: bigint("download_limit", { mode: "number" }).notNull().default(0),
  totalLimit: bigint("total_limit", { mode: "number" }).notNull().default(0),
  expiresAt: timestamp("expires_at"),
  enabled: boolean("enabled").notNull().default(true),
  totalTx: bigint("total_tx", { mode: "number" }).notNull().default(0),
  totalRx: bigint("total_rx", { mode: "number" }).notNull().default(0),
  lastApiTx: bigint("last_api_tx", { mode: "number" }).notNull().default(0),
  lastApiRx: bigint("last_api_rx", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, {
    fields: [clients.userId],
    references: [users.id],
  }),
  server: one(servers, {
    fields: [clients.serverId],
    references: [servers.id],
  }),
  stats: many(clientStats),
}));

export type ClientSelect = typeof clients.$inferSelect;
export type ClientInsert = typeof clients.$inferInsert;
