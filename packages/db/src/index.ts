import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

export * from "./schema";

let connection: mysql.Connection | null = null;

export async function createConnection() {
  if (!connection) {
    connection = await mysql.createConnection(process.env.DATABASE_URL!);
  }
  return connection;
}

export async function getDb() {
  const conn = await createConnection();
  return drizzle(conn, { schema, mode: "default" });
}

export type Database = Awaited<ReturnType<typeof getDb>>;
