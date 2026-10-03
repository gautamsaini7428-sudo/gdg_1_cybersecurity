/**
 * Authentication middleware.
 * Verifies the server-side session cookie and attaches the user to the request.
 */

import type { Request, Response, NextFunction } from "express";
import { userRepo } from "../repository.js";

// Extend express-session typings with our session fields
declare module "express-session" {
  interface SessionData {
    userId: string;
    createdAt: number; // ms timestamp when session was created
    sessionVersion?: number;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ success: false, message: "Authentication required. Please sign in." });
    return;
  }

  const user = userRepo.findById(req.session.userId);
  if (!user) {
    // Orphaned session — destroy and clear cookie
    req.session.destroy(() => {});
    res.status(401).json({ success: false, message: "Session invalid. Please sign in again." });
    return;
  }

  // Check if session has been revoked (e.g. via password reset)
  if (
    req.session.sessionVersion !== undefined &&
    user.session_version !== undefined &&
    req.session.sessionVersion < user.session_version
  ) {
    req.session.destroy(() => {});
    res.status(401).json({ success: false, message: "Session revoked. Please sign in again." });
    return;
  }

  next();
}
