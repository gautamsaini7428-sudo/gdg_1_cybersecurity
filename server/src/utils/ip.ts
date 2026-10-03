/**
 * Helper to extract the real client IP, respecting the X-Forwarded-For header
 * that load balancers set in production.
 */
import type { Request } from "express";

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}
