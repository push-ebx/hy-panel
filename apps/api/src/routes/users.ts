import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as argon2 from "argon2";
import { eq } from "drizzle-orm";
import { getDb, users } from "@hy2-panel/db";
import { authMiddleware } from "../middleware/auth";
import { ApiError } from "../middleware/error-handler";
import type { ApiResponse } from "@hy2-panel/shared";

const createUserSchema = z.object({
  username: z.string().min(3).max(255),
  email: z.string().email(),
  password: z.string().min(8),
});

const updateUserSchema = z.object({
  username: z.string().min(3).max(255).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

export const usersRoutes = new Hono();

usersRoutes.use("*", authMiddleware);

usersRoutes.get("/", async (c) => {
  const db = await getDb();
  const allUsers = await db.query.users.findMany();

  return c.json<ApiResponse>({
    success: true,
    data: allUsers.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
  });
});

usersRoutes.post("/", zValidator("json", createUserSchema), async (c) => {
  const data = c.req.valid("json");
  const db = await getDb();

  const passwordHash = await argon2.hash(data.password);
  const id = crypto.randomUUID();

  await db.insert(users).values({
    id,
    username: data.username,
    email: data.email,
    passwordHash,
  });

  return c.json<ApiResponse>(
    {
      success: true,
      data: { id },
      message: "User created",
    },
    201
  );
});

usersRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = await getDb();

  const result = await db.delete(users).where(eq(users.id, id));

  if (result[0].affectedRows === 0) {
    throw new ApiError(404, "User not found");
  }

  return c.json<ApiResponse>({
    success: true,
    message: "User deleted",
  });
});
