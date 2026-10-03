/**
 * Database Seed Script
 * Pre-populates the SQLite database with demonstration accounts and audit logs.
 *
 * Usage:
 *   npm run seed
 */

import { v4 as uuidv4 } from "uuid";
import { userRepo, activityRepo } from "./repository.js";
import { hashPassword } from "./crypto.js";

async function seed() {
  console.log("🌱 Seeding SecureAuth database...");

  const demoAccounts = [
    {
      name: "Alex Security",
      email: "alex@secureauth.io",
      password: "StrongPassword123!",
    },
    {
      name: "Security Auditor",
      email: "auditor@enterprise.corp",
      password: "EnterpriseAudit999!",
    },
  ];

  for (const account of demoAccounts) {
    if (userRepo.emailExists(account.email)) {
      console.log(`ℹ️  Account ${account.email} already exists — skipping.`);
      continue;
    }

    const passwordHash = await hashPassword(account.password);
    const userId = uuidv4();
    const now = new Date().toISOString();

    const created = userRepo.create({
      id: userId,
      name: account.name,
      email: account.email,
      passwordHash,
      createdAt: now,
      emailVerified: true,
    });

    console.log(`✅ Created demo user: ${created.email} (Password: ${account.password})`);

    // Add some sample audit activity for demonstration
    const sampleAttempts = [
      {
        offsetMinutes: 120,
        success: true,
        ip: "192.168.1.42",
        ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
      },
      {
        offsetMinutes: 45,
        success: false,
        ip: "203.0.113.195",
        ua: "curl/8.4.0 (Security Scanner)",
        reason: "Invalid password",
      },
      {
        offsetMinutes: 10,
        success: true,
        ip: "192.168.1.42",
        ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
      },
    ];

    for (const sample of sampleAttempts) {
      activityRepo.record({
        id: uuidv4(),
        userId: created.id,
        timestamp: new Date(Date.now() - sample.offsetMinutes * 60 * 1000).toISOString(),
        ip: sample.ip,
        userAgent: sample.ua,
        success: sample.success,
        failureReason: sample.reason,
      });
    }
  }

  console.log("✨ Seeding completed successfully!\n");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
