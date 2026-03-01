import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, servers } from "@hy2-panel/db";
import { authMiddleware } from "../middleware/auth";
import { ApiError } from "../middleware/error-handler";
import type { ApiResponse } from "@hy2-panel/shared";

const createServerSchema = z.object({
  name: z.string().min(1).max(255),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  config: z.object({
    listen: z.string(),
    tls: z.object({
      cert: z.string(),
      key: z.string(),
    }),
    obfs: z
      .object({
        type: z.literal("salamander"),
        salamander: z.object({
          password: z.string(),
        }),
      })
      .optional(),
  }),
});

export const serversRoutes = new Hono();

serversRoutes.use("*", authMiddleware);

serversRoutes.get("/", async (c) => {
  const db = await getDb();
  const allServers = await db.query.servers.findMany();

  return c.json<ApiResponse>({
    success: true,
    data: allServers,
  });
});

serversRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = await getDb();

  const server = await db.query.servers.findFirst({
    where: eq(servers.id, id),
  });

  if (!server) {
    throw new ApiError(404, "Server not found");
  }

  return c.json<ApiResponse>({
    success: true,
    data: server,
  });
});

serversRoutes.post("/", zValidator("json", createServerSchema), async (c) => {
  const data = c.req.valid("json");
  const db = await getDb();

  const id = crypto.randomUUID();
  const agentToken = crypto.randomUUID();

  await db.insert(servers).values({
    id,
    name: data.name,
    host: data.host,
    port: data.port,
    agentToken,
    config: data.config,
  });

  return c.json<ApiResponse>(
    {
      success: true,
      data: { id, agentToken },
      message: "Server created",
    },
    201
  );
});

serversRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = await getDb();

  const result = await db.delete(servers).where(eq(servers.id, id));

  if (result[0].affectedRows === 0) {
    throw new ApiError(404, "Server not found");
  }

  return c.json<ApiResponse>({
    success: true,
    message: "Server deleted",
  });
});
