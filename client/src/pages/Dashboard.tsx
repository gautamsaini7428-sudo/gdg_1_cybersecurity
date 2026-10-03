import { useEffect, useState, useCallback } from "react";
import { BrandMark } from "@/components/BrandMark";
import { useAuth } from "@/contexts/AuthContext";
import { api, LoginEvent, SessionInfo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  LogOut,
  Lock,
  KeyRound,
  UserCheck,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Monitor,
  Smartphone,
  Globe,
  RefreshCw,
  CalendarDays,
  Fingerprint,
  ShieldAlert,
  TimerReset,
} from "lucide-react";
import { useLocation } from "wouter";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatAbsolute(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function detectDevice(ua: string): { icon: typeof Monitor; label: string } {
  const lower = ua.toLowerCase();
  if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
    return { icon: Smartphone, label: "Mobile" };
  }
  return { icon: Monitor, label: "Desktop" };
}

function detectBrowser(ua: string): string {
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Browser";
}

// ── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
  danger = false,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5 ${
        danger
          ? "border-red-200 bg-red-50"
          : accent
            ? "border-[#A7F3D0]/60 bg-[#0B2925]/5"
            : "border-[#E5DDD8] bg-[#F8F5F3]"
      }`}
    >
      <div className={`flex items-center gap-2 ${danger ? "text-red-600" : "text-[#0B2925]"}`}>
        <Icon className="h-4 w-4 shrink-0" />
        <h3 className="text-xs font-bold uppercase tracking-wider">{label}</h3>
      </div>
      <p
        className={`mt-2.5 text-xl font-extrabold font-display tracking-tight ${
          danger ? "text-red-700" : "text-[#0B2925]"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className={`mt-0.5 text-xs ${danger ? "text-red-500" : "text-[#755B73]"}`}>{sub}</p>
      )}
    </motion.div>
  );
}

// ── ActivityRow ───────────────────────────────────────────────────────────────

function ActivityRow({ event, index }: { event: LoginEvent; index: number }) {
  const { icon: DeviceIcon, label: deviceLabel } = detectDevice(event.userAgent);
  const browser = detectBrowser(event.userAgent);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.22 }}
      className={`flex items-center gap-4 rounded-xl border px-4 py-3 text-sm transition ${
        event.success
          ? "border-[#E5DDD8] bg-white hover:border-[#A7F3D0]/60"
          : "border-red-100 bg-red-50/50 hover:border-red-200"
      }`}
    >
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
          event.success ? "bg-[#A7F3D0]/30 text-[#0B2925]" : "bg-red-100 text-red-600"
        }`}
      >
        {event.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={`text-xs font-bold ${event.success ? "text-[#0B2925]" : "text-red-700"}`}>
            {event.success ? "Sign-in successful" : "Failed sign-in"}
          </span>
          {!event.success && event.failureReason && (
            <span className="text-[10px] font-semibold text-red-400">· {event.failureReason}</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#755B73]">
          <span className="flex items-center gap-1">
            <DeviceIcon className="h-3 w-3" />
            {deviceLabel} · {browser}
          </span>
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            {event.ip}
          </span>
        </div>
      </div>

      <span className="shrink-0 text-[11px] text-[#755B73]">
        {formatRelative(event.timestamp)}
      </span>
    </motion.div>
  );
}

// ── Dashboard page ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [failedLast24h, setFailedLast24h] = useState<number>(0);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadSessionInfo = useCallback(async () => {
    try {
      const res = await api.me();
      if (res.session) setSessionInfo(res.session);
    } catch {
      // silently fail — user is already available from AuthContext
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const res = await api.activity();
      setEvents(res.events);
      setFailedLast24h(res.failedLast24h);
    } catch {
      // silently fail
    } finally {
      setIsLoadingActivity(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadSessionInfo(), loadActivity()]);
    setLastRefreshed(new Date());
    setIsRefreshing(false);
  }, [loadSessionInfo, loadActivity]);

  useEffect(() => {
    loadSessionInfo();
    loadActivity();
  }, [loadSessionInfo, loadActivity]);

  const handleSignOut = async () => {
    await logout();
    setLocation("/access?mode=signin");
  };

  const sessionAge = sessionInfo?.createdAt ? formatRelative(sessionInfo.createdAt) : null;
  const lastLogin = user?.lastLoginAt ? formatAbsolute(user.lastLoginAt) : null;
  const successCount = events.filter((e) => e.success).length;
  const failCount = events.filter((e) => !e.success).length;

  return (
    <div className="min-h-screen bg-[#F8F5F3] text-[#27212B]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-[#E5DDD8] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <BrandMark />
          <div className="flex items-center gap-3">
            <button
              id="dashboard-refresh"
              onClick={refresh}
              disabled={isRefreshing}
              title="Refresh data"
              className="hidden sm:grid h-8 w-8 place-items-center rounded-xl border border-[#E5DDD8] text-[#755B73] transition hover:border-[#0B2925] hover:text-[#0B2925] disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-[#0B2925]">{user?.name || "Authenticated User"}</p>
              <p className="text-[11px] text-[#755B73]">{user?.email || "user@domain.com"}</p>
            </div>
            <Button
              id="dashboard-signout"
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="rounded-xl border-[#E5DDD8] text-xs font-bold gap-2 text-[#755B73] hover:text-[#0B2925] hover:border-[#0B2925]"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-8">

        {/* Welcome banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-[#E5DDD8] bg-white p-7 shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#A7F3D0]/40 bg-[#0B2925]/5 px-3 py-1 text-xs font-bold text-[#0B2925]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#0B2925]" />
                Protected Route Active
              </div>
              <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-[#0B2925]">
                Welcome back, {user?.name?.split(" ")[0] || "User"}
              </h1>
              <p className="mt-1 text-sm text-[#755B73]">
                Your session is verified and defended by cryptographic cookies and rate-limiting middleware.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-[#A7F3D0] text-[#0B2925] hover:bg-[#86EFAC] px-3 py-1 text-xs font-bold">
                Session Authenticated
              </Badge>
              {failedLast24h > 0 && (
                <Badge className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 text-xs font-bold border-0">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {failedLast24h} failed attempt{failedLast24h > 1 ? "s" : ""} (24h)
                </Badge>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoadingSession ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-[96px] rounded-2xl" />
              ))}
            </>
          ) : (
            <>
              <StatCard
                icon={UserCheck}
                label="Identity"
                value={user?.name || "Active Member"}
                sub={user?.email}
                accent
              />
              <StatCard
                icon={Lock}
                label="Session Guard"
                value="HttpOnly · SameSite"
                sub={sessionAge ? `Started ${sessionAge}` : "Active session"}
              />
              <StatCard
                icon={KeyRound}
                label="Password Storage"
                value="bcrypt · 12 rounds"
                sub="OWASP ASVS Level 1"
              />
              <StatCard
                icon={failedLast24h > 0 ? ShieldAlert : ShieldCheck}
                label="Threat Signal (24h)"
                value={`${failedLast24h} failed attempt${failedLast24h !== 1 ? "s" : ""}`}
                sub={failedLast24h > 0 ? "Review activity below" : "No suspicious activity"}
                danger={failedLast24h > 2}
              />
            </>
          )}
        </div>

        {/* Session details + security policy */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Session Details */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-[#E5DDD8] bg-white p-6"
          >
            <div className="flex items-center gap-2 text-[#0B2925]">
              <CalendarDays className="h-4 w-4" />
              <h2 className="text-xs font-bold uppercase tracking-wider">Session Details</h2>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { label: "Signed in", icon: Clock, value: isLoadingSession ? null : formatAbsolute(sessionInfo?.createdAt) },
                { label: "Session expires", icon: TimerReset, value: isLoadingSession ? null : formatAbsolute(sessionInfo?.expiresAt) },
                { label: "Last login", icon: Fingerprint, value: isLoadingSession ? null : (lastLogin ?? "—") },
                { label: "Account created", icon: CalendarDays, value: isLoadingSession ? null : formatAbsolute(user?.createdAt) },
              ].map(({ label, icon: Icon, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[#F0EAE7] bg-[#F8F5F3] px-4 py-3"
                >
                  <div className="flex items-center gap-2 text-[#755B73]">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs font-semibold">{label}</span>
                  </div>
                  {value === null ? (
                    <Skeleton className="h-4 w-28" />
                  ) : (
                    <span className="text-xs font-bold text-[#0B2925]">{value}</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Security Policy */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-[#E5DDD8] bg-white p-6"
          >
            <div className="flex items-center gap-2 text-[#0B2925]">
              <ShieldCheck className="h-4 w-4" />
              <h2 className="text-xs font-bold uppercase tracking-wider">Security Policy</h2>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { label: "Password hashing", detail: "bcrypt · 12 salt rounds (OWASP ASVS L1)" },
                { label: "Session cookie", detail: "HttpOnly · SameSite=Strict · Secure (prod)" },
                { label: "Lockout policy", detail: "5 failed attempts → 15-min lockout" },
                { label: "Rate limiting", detail: "10 login attempts / 15 min per IP" },
                { label: "Timing safety", detail: "Constant-time comparison prevents user enumeration" },
                { label: "Session fixation", detail: "Session ID regenerated on every login" },
              ].map(({ label, detail }) => (
                <div
                  key={label}
                  className="flex items-start gap-3 rounded-xl border border-[#F0EAE7] bg-[#F8F5F3] px-4 py-3"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0B2925]" />
                  <div>
                    <p className="text-xs font-bold text-[#27212B]">{label}</p>
                    <p className="mt-0.5 text-[11px] text-[#755B73]">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Login Activity Log */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-[#E5DDD8] bg-white p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[#0B2925]">
              <Activity className="h-4 w-4" />
              <h2 className="text-xs font-bold uppercase tracking-wider">Login Activity</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isLoadingActivity && events.length > 0 && (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#A7F3D0]/30 px-2.5 py-0.5 text-[11px] font-bold text-[#0B2925]">
                    <CheckCircle2 className="h-3 w-3" />
                    {successCount} success
                  </span>
                  {failCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                      <XCircle className="h-3 w-3" />
                      {failCount} failed
                    </span>
                  )}
                </>
              )}
              <span className="text-[11px] text-[#755B73]">
                Refreshed {formatRelative(lastRefreshed.toISOString())}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <AnimatePresence mode="wait">
              {isLoadingActivity ? (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-xl" />
                  ))}
                </motion.div>
              ) : events.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#E5DDD8] py-12 text-center"
                >
                  <Activity className="h-7 w-7 text-[#C5B8C2]" />
                  <p className="text-sm font-semibold text-[#755B73]">No activity recorded yet</p>
                  <p className="text-xs text-[#C5B8C2]">
                    Login events will appear here after sign-in attempts.
                  </p>
                </motion.div>
              ) : (
                <motion.div key="events" className="space-y-2">
                  {events.map((event, i) => (
                    <ActivityRow key={event.id} event={event} index={i} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

      </main>
    </div>
  );
}
