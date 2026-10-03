import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

// Load environment variables before importing services
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEnvPath = path.resolve(__dirname, "../../.env");
const rootEnvPath = path.resolve(__dirname, "../../../.env");

if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

import { sendOtpEmail, verifySmtp } from "../services/emailService.js";

async function main() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const recipient = args[0]?.trim();

  console.log("\n🧪 SecureAuth SMTP Email Test Utility");
  console.log("======================================");

  if (!recipient) {
    console.error("\n❌ Error: Recipient email address is required.\n");
    console.log("Usage:");
    console.log("  npm run test:email <email-address>");
    console.log("  npm run test:email -- <email-address>\n");
    console.log("Example:");
    console.log("  npm run test:email developer@gmail.com\n");
    process.exit(1);
  }

  // Simple email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipient)) {
    console.error(`\n❌ Error: "${recipient}" is not a valid email address.\n`);
    process.exit(1);
  }

  console.log(`\n1. Verifying SMTP connection to ${process.env.SMTP_HOST || "unconfigured"}...`);
  const verifyResult = await verifySmtp();

  if (!verifyResult.ok) {
    console.error(`\n❌ Cannot send test email because SMTP verification failed: ${verifyResult.message}`);
    console.error("Please configure valid SMTP credentials in your .env or server/.env file.\n");
    process.exit(1);
  }

  console.log(`\n2. Dispatching styled test OTP email to: ${recipient}...`);
  const testCode = "842915";
  const minutesValid = 10;

  try {
    const result = await sendOtpEmail(recipient, testCode, minutesValid);
    console.log(`\n✅ Test OTP email sent successfully!`);
    console.log(`   Recipient : ${recipient}`);
    console.log(`   Subject   : "Your SecureAuth verification code"`);
    if (result.messageId) {
      console.log(`   Message ID: ${result.messageId}`);
    }
    console.log("\nPlease check your inbox (and spam/junk folder) for the test email.\n");
  } catch (error: any) {
    console.error(`\n❌ Failed to dispatch test email to ${recipient}:`);
    console.error(`   ${error?.message || error}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error during test execution:", err);
  process.exit(1);
});
