import { config } from "dotenv";
import { resolve } from "path";

// Find root .env file
function findRootEnv(): string {
  let dir = process.cwd();

  // Walk up to find monorepo root (has pnpm-workspace.yaml)
  for (let i = 0; i < 5; i++) {
    const envPath = resolve(dir, ".env");
    const workspacePath = resolve(dir, "pnpm-workspace.yaml");

    try {
      require("fs").accessSync(workspacePath);
      return envPath;
    } catch {
      dir = resolve(dir, "..");
    }
  }

  return resolve(process.cwd(), ".env");
}

export function loadEnv() {
  const envPath = findRootEnv();
  config({ path: envPath });
}

// Validation
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}
