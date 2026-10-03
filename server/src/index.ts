import "./env.js";
import express from "express";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AUTH_CONFIG } from "../../shared/const.js";
import authRouter from "./routes/auth.js";
import { verifySmtp } from "./services/emailService.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const IS_PROD = process.env.NODE_ENV === "production";
const IS_TEST = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);

// ── Security Headers via Helmet ─────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: IS_PROD ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS ────────────────────────────────────────────────────────────────────
// Allow the Vite dev server / frontend to communicate with cookies and CSRF headers
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true, // Required for HttpOnly cookie sessions
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-csrf-token", AUTH_CONFIG.CSRF_HEADER],
  })
);

// ── Parsing Middleware ───────────────────────────────────────────────────────
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser(process.env.SESSION_SECRET || "dev-cookie-secret-min-32-chars-long"));

// ── Session ──────────────────────────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && IS_PROD) {
  console.error("FATAL: SESSION_SECRET environment variable must be set in production.");
  process.exit(1);
}

app.use(
  session({
    name: AUTH_CONFIG.COOKIE_NAME,
    secret: SESSION_SECRET || "dev-secret-change-in-production-32chars-min",
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on each active request
    cookie: {
      httpOnly: true, // Prevent client-side JS access
      secure: IS_PROD, // HTTPS only in production
      sameSite: "lax",
      maxAge: AUTH_CONFIG.SESSION_LIFETIME_HOURS * 60 * 60 * 1000,
    },
  })
);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "SecureAuth Server",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// Global error handler (handles CSRF, validation, and unhandled errors)
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    // csrf-csrf error detection
    if (err.code === "EBADCSRFTOKEN" || err.status === 403 || err.message?.includes("csrf")) {
      res.status(403).json({
        success: false,
        message: "Invalid or missing CSRF token.",
      });
      return;
    }

    if (!IS_TEST) {
      console.error("[unhandled error]", err);
    }
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal server error.",
    });
  }
);

// ── Start Server ─────────────────────────────────────────────────────────────
if (!IS_TEST) {
  app.listen(PORT, async () => {
    console.log(`\n🔐 SecureAuth server running on http://localhost:${PORT}`);
    console.log(`   Environment : ${IS_PROD ? "production" : "development"}`);
    console.log(
      `   Session     : Cookie='${AUTH_CONFIG.COOKIE_NAME}' · HttpOnly · SameSite=lax · Secure=${IS_PROD}`
    );
    console.log(
      `   Auth routes : /api/auth/{csrf-token,register,login,logout,me,activity,forgot-password,reset-password}\n`
    );
    await verifySmtp();
  });
}

export default app;
