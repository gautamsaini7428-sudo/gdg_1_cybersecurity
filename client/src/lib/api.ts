export type User = {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  lastLoginAt?: string;
  totpEnabled?: boolean;
};

export type LoginEvent = {
  id: string;
  userId: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
};

export type SessionInfo = {
  createdAt: string | null;
  expiresAt: string | null;
};

export class ApiError extends Error {
  status: number;
  data: any;
  retryAfterSeconds?: number;
  lockedUntil?: string;
  code?: string;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    if (data?.code) {
      this.code = String(data.code);
    }
    if (data?.retryAfterSeconds) {
      this.retryAfterSeconds = Number(data.retryAfterSeconds);
    }
    if (data?.lockedUntil) {
      this.lockedUntil = String(data.lockedUntil);
    }
  }
}

let cachedCsrfToken: string | null = null;

async function getCsrfToken(forceFresh = false): Promise<string> {
  if (cachedCsrfToken && !forceFresh) {
    return cachedCsrfToken;
  }
  try {
    const res = await fetch("/api/auth/csrf-token", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      cachedCsrfToken = data.csrfToken;
      return cachedCsrfToken || "";
    }
  } catch (err) {
    console.warn("Could not fetch CSRF token:", err);
  }
  return "";
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isStateChanging = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (isStateChanging && !headers["x-csrf-token"]) {
    const token = await getCsrfToken();
    if (token) {
      headers["x-csrf-token"] = token;
    }
  }

  let response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: "include",
  });

  // If CSRF rejected, refresh token and retry once
  if (response.status === 403 && isStateChanging) {
    const freshToken = await getCsrfToken(true);
    if (freshToken) {
      headers["x-csrf-token"] = freshToken;
      response = await fetch(endpoint, {
        ...options,
        headers,
        credentials: "include",
      });
    }
  }

  const contentType = response.headers.get("content-type");
  const data = contentType && contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    let message = "An error occurred";
    if (typeof data === "object" && data !== null && data.message) {
      message = data.message;
    } else if (response.status === 401) {
      // OWASP: Never reveal whether email or password was incorrect
      message = "Invalid email or password";
    } else if (response.status === 429) {
      message = "Too many attempts. Account temporarily locked.";
    }

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export const api = {
  register: (payload: { name: string; email: string; password: string }) =>
    request<{ success: boolean; user: User; message?: string; emailVerificationRequired?: boolean }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  verifyEmail: (payload: { email: string; code: string }) =>
    request<{ success: boolean; user?: User; message?: string }>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  resendVerification: (payload: { email: string }) =>
    request<{ success: boolean; message?: string; retryAfterSeconds?: number }>("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string; totp?: string }) =>
    request<{ success: boolean; user?: User; requires2fa?: boolean; message?: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request<{ success: boolean; message?: string }>("/api/auth/logout", {
      method: "POST",
    }),

  me: () =>
    request<{ success: boolean; user: User; session?: SessionInfo }>("/api/auth/me", {
      method: "GET",
    }),

  activity: () =>
    request<{ success: boolean; events: LoginEvent[]; failedLast24h: number }>("/api/auth/activity", {
      method: "GET",
    }),

  forgotPassword: (payload: { email: string }) =>
    request<{ success: boolean; message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  verifyResetOtp: (payload: { email: string; code: string; totp?: string }) =>
    request<{ success: boolean; resetToken?: string; requires2fa?: boolean; message?: string }>("/api/auth/verify-reset-otp", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  resetPassword: (payload: { resetToken: string; newPassword: string }) =>
    request<{ success: boolean; message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  setup2fa: () =>
    request<{ success: boolean; secret: string; qrCode: string }>("/api/auth/2fa/setup", {
      method: "POST",
    }),

  enable2fa: (payload: { code: string }) =>
    request<{ success: boolean; recoveryCodes: string[] }>("/api/auth/2fa/enable", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  disable2fa: (payload: { password: string; code: string }) =>
    request<{ success: boolean; message: string }>("/api/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
