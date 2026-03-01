import { loadEnv } from "@hy2-panel/shared";
loadEnv();

import * as argon2 from "argon2";
import { getDb, users } from "@hy2-panel/db";

async function seed() {
  const db = await getDb();

  const passwordHash = await argon2.hash("admin123");

  await db.insert(users).values({
    id: crypto.randomUUID(),
    username: "admin",
    email: "admin@example.com",
    passwordHash,
  }).onDuplicateKeyUpdate({
    set: { username: "admin" },
  });

  console.log("Seed completed!");
  console.log("Login: admin@example.com");
  console.log("Password: admin123");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
