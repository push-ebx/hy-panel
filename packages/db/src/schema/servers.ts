import { mysqlTable, varchar, timestamp, mysqlEnum } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { clients } from "./clients";

export const servers = mysqlTable("servers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  host: varchar("host", { length: 255 }).notNull(),
  agentUrl: varchar("agent_url", { length: 255 }).notNull(),
  agentToken: varchar("agent_token", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["online", "offline", "error"]).notNull().default("offline"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const serversRelations = relations(servers, ({ many }) => ({
  clients: many(clients),
}));

export type ServerSelect = typeof servers.$inferSelect;
export type ServerInsert = typeof servers.$inferInsert;
