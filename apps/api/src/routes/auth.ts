import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { SignJWT } from "jose";
import * as argon2 from "argon2";
import { eq } from "drizzle-orm";
import { getDb, users } from "@hy2-panel/db";
import { authMiddleware } from "../middleware/auth";
import { ApiError } from "../middleware/error-handler";
import type { ApiResponse, AuthResponse } from "@hy2-panel/shared";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "secret");

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes = new Hono();

authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const db = await getDb();

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const validPassword = await argon2.verify(user.passwordHash, password);
  if (!validPassword) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = await new SignJWT({ sub: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  return c.json<ApiResponse<AuthResponse>>({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    },
  });
});

authRoutes.get("/me", authMiddleware, async (c) => {
  const payload = c.get("user");
  const db = await getDb();

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return c.json<ApiResponse>({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});
