import { mysqlTable, varchar, timestamp } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { clients } from "./clients";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  clients: many(clients),
}));

export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
