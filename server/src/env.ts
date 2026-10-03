import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from least-specific to most-specific, with override: true so that
// server/.env (most specific) always wins over the root .env (least specific).
// This prevents the root .env's empty SMTP_USER/SMTP_PASS from blocking the
// real credentials defined in server/.env.
const candidatePaths = [
  path.resolve(__dirname, "../../../.env"),        // root .env  (least specific)
  path.resolve(process.cwd(), ".env"),             // cwd .env
  path.resolve(__dirname, "../../.env"),           // server/.env (most specific)
  path.resolve(process.cwd(), "server/.env"),      // fallback for root-level cwd
];

const wasTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);

for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true });
  }
}

if (wasTestEnv) {
  process.env.NODE_ENV = "test";
}
