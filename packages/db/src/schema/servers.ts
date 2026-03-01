import { mysqlTable, varchar, int, timestamp, json, mysqlEnum } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { clients } from "./clients";
import { serverStats } from "./stats";
import type { Hy2Config } from "@hy2-panel/shared";

export const servers = mysqlTable("servers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  host: varchar("host", { length: 255 }).notNull(),
  port: int("port").notNull().default(443),
  status: mysqlEnum("status", ["online", "offline", "error"]).notNull().default("offline"),
  agentToken: varchar("agent_token", { length: 255 }).notNull().unique(),
  config: json("config").$type<Hy2Config>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const serversRelations = relations(servers, ({ many }) => ({
  clients: many(clients),
  stats: many(serverStats),
}));

export type ServerSelect = typeof servers.$inferSelect;
export type ServerInsert = typeof servers.$inferInsert;
