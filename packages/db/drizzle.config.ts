import { loadEnv } from "@hy2-panel/shared";
import { defineConfig } from "drizzle-kit";

loadEnv();

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
