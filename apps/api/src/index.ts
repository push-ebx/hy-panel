import { loadEnv } from "@hy2-panel/shared";
loadEnv();

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth";
import { usersRoutes } from "./routes/users";
import { serversRoutes } from "./routes/servers";
import { clientsRoutes } from "./routes/clients";
import { errorHandler } from "./middleware/error-handler";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// API routes
app.route("/api/auth", authRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/servers", serversRoutes);
app.route("/api/clients", clientsRoutes);

// Error handler
app.onError(errorHandler);

const port = Number(process.env.PORT) || 4000;

console.log(`HTTP server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
