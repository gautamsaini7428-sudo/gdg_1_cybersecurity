import { z } from "zod";

/**
 * Granular password requirement rules for UI checklist and validation.
 */
export const passwordRules = [
  { id: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "uppercase", label: "At least one uppercase letter (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "At least one lowercase letter (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { id: "number", label: "At least one number (0-9)", test: (p: string) => /[0-9]/.test(p) },
  { id: "symbol", label: "At least one symbol (!@#$%...)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

/**
 * Calculates live password strength score and percentage for Progress meter.
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  percent: number;
  label: "Empty" | "Weak" | "Fair" | "Good" | "Strong";
} {
  if (!password) {
    return { score: 0, percent: 0, label: "Empty" };
  }

  const passedCount = passwordRules.filter((r) => r.test(password)).length;
  const percent = Math.min(100, Math.round((passedCount / passwordRules.length) * 100));

  if (passedCount <= 2) {
    return { score: passedCount, percent: Math.max(20, percent), label: "Weak" };
  }
  if (passedCount === 3) {
    return { score: passedCount, percent, label: "Fair" };
  }
  if (passedCount === 4) {
    return { score: passedCount, percent, label: "Good" };
  }
  return { score: passedCount, percent: 100, label: "Strong" };
}

const baseRegisterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string(),
});

export const registerSchema = baseRegisterSchema.refine(
  (data: z.infer<typeof baseRegisterSchema>) => data.password === data.confirmPassword,
  {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }
);

export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
});

const baseResetPasswordSchema = z.object({
  token: z.string().optional(),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmNewPassword: z.string(),
});

export const resetPasswordSchema = baseResetPasswordSchema.refine(
  (data: z.infer<typeof baseResetPasswordSchema>) => data.newPassword === data.confirmNewPassword,
  {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  }
);

export const verifyResetOtpSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  code: z.string().trim().length(6, "Verification code must be 6 digits"),
  totp: z.string().trim().optional(),
});

const baseResetPasswordWithTokenSchema = z.object({
  resetToken: z.string().min(1, "Reset token is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmNewPassword: z.string().optional(),
});

export const resetPasswordWithTokenSchema = baseResetPasswordWithTokenSchema.refine(
  (data: z.infer<typeof baseResetPasswordWithTokenSchema>) =>
    !data.confirmNewPassword || data.newPassword === data.confirmNewPassword,
  {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  }
);

export const enable2faSchema = z.object({
  code: z.string().trim().min(6, "Code must be at least 6 characters").max(10),
});

export const disable2faSchema = z.object({
  password: z.string().min(1, "Password is required"),
  code: z.string().trim().min(6, "Code must be at least 6 characters").max(10),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordWithTokenInput = z.infer<typeof resetPasswordWithTokenSchema>;

