import type { Context, Next } from "hono";
import { jwtVerify } from "jose";
import { ApiError } from "./error-handler";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "secret");

export interface JwtPayload {
  sub: string;
  exp: number;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Unauthorized");
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    c.set("user", payload as JwtPayload);
    await next();
  } catch {
    throw new ApiError(401, "Invalid token");
  }
}
