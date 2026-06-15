import { timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { getEnv } from "../config.js";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function requireAdminAuth(c: Context, next: Next) {
  const token = extractBearerToken(c.req.header("Authorization"));
  const expected = getEnv().ADMIN_API_TOKEN;

  if (!token || !safeEqual(token, expected)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
}
