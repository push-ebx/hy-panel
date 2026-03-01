import type { Context } from "hono";
import type { ApiResponse } from "@hy2-panel/shared";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorHandler(err: Error, c: Context) {
  console.error(err);

  if (err instanceof ApiError) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: err.message,
      },
      err.statusCode
    );
  }

  return c.json<ApiResponse>(
    {
      success: false,
      error: "Internal server error",
    },
    500
  );
}
