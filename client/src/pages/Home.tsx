import { useState, useRef, useEffect } from "react";
import { BrandMark } from "@/components/BrandMark";
import CampusHero from "@/components/CampusHero";
import AuthFlowScrollArena from "@/components/AuthFlowScrollArena";
import { Button } from "@/components/ui/button";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import { AUTH_CONFIG } from "@/const";

const reveal = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } };

function Counter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const startedAt = performance.now();
    const frame = (now: number) => {
      const progress = Math.min((now - startedAt) / 950, 1);
      setValue(Math.floor(end * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [end, isInView]);

  return (
    <span ref={ref}>
      {prefix}
      {value}
      {suffix}
    </span>
  );
}

const platformCards = [
  [KeyRound, "Password hashing", "Salted bcrypt with 12 work rounds protects stored credentials against offline dictionary attacks."],
  [ShieldCheck, "Session protection", "Cryptographically signed HttpOnly, SameSite=Strict cookies shield active sessions from XSS and CSRF."],
  [ShieldAlert, "Brute-force defense", "Automated lockout after 5 consecutive failed attempts stops credential-stuffing and spray attacks."],
  [CheckCheck, "Input validation", "Strict Zod schemas sanitize and validate email format, password strength, and request payloads on entry."],
] as const;

export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <main className="overflow-hidden bg-[#F8F5F3] text-[#27212B]">
      {/* ================= HERO SECTION ================= */}
      <div className="relative">
        <header className="absolute inset-x-0 top-0 z-30 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <BrandMark inverse />
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#F8F5F3]/90 lg:flex">
            <a href="#features" className="transition hover:text-[#A7F3D0]">Features</a>
            <a href="#arena" className="transition hover:text-[#A7F3D0]">Auth Flow</a>
            <a href="#workflow" className="transition hover:text-[#A7F3D0]">How it works</a>
            <a href="#security" className="transition hover:text-[#A7F3D0]">Security</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/access?mode=signin")}
              className="hidden text-xs font-bold text-[#F8F5F3]/90 transition hover:text-[#A7F3D0] sm:block"
            >
              Sign in
            </button>
            <Button
              onClick={() => setLocation("/access?mode=signup")}
              className="h-10 bg-[#A7F3D0] px-4 text-xs font-bold text-[#0B2925] shadow-[0_6px_18px_rgba(167,243,208,0.25)] transition hover:bg-[#86EFAC]"
            >
              Get started <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        <CampusHero>
          <div className="relative z-10 mx-auto flex min-h-[860px] max-w-7xl flex-col justify-end px-5 pb-20 pt-32 sm:px-8 lg:pb-28">
            <motion.div
              initial="hidden"
              animate="visible"
              transition={{ staggerChildren: 0.08 }}
              className="relative z-10 max-w-3xl"
            >
              <motion.div
                variants={reveal}
                transition={{ duration: 0.35 }}
                className="inline-flex items-center gap-2 rounded-full border border-[#A7F3D0]/40 bg-[#0B2925]/75 px-3.5 py-1.5 text-xs font-bold text-[#A7F3D0] backdrop-blur-md"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#A7F3D0]" /> Secure by design · OWASP-aligned
              </motion.div>

              <motion.h1
                variants={reveal}
                transition={{ duration: 0.35 }}
                className="mt-6 font-display text-5xl font-extrabold leading-[1.04] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl"
              >
                Authentication that's{" "}
                <span className="text-[#A7F3D0]">
                  secure
                </span>
                , not stressful.
              </motion.h1>

              <motion.p
                variants={reveal}
                transition={{ duration: 0.35 }}
                className="mt-6 max-w-xl text-base leading-7 text-[#F8F5F3]/90 sm:text-lg"
              >
                A complete registration and login system with hashed passwords, protected routes,
                input validation, and brute-force protection. Every security decision is documented.
              </motion.p>

              <motion.div
                variants={reveal}
                transition={{ duration: 0.35 }}
                className="mt-8 flex flex-wrap gap-3.5"
              >
                <button
                  onClick={() => setLocation("/access?mode=signup")}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-[#A7F3D0] px-6 text-sm font-bold text-[#0B2925] shadow-[0_10px_25px_rgba(167,243,208,0.25)] transition duration-300 hover:bg-[#6EE7B7]"
                >
                  Create account <ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <button
                  onClick={() => setLocation("/access?mode=signin")}
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#A7F3D0]/40 bg-[#0B2925]/60 px-5 text-sm font-bold text-[#F8F5F3] backdrop-blur transition hover:border-[#A7F3D0] hover:bg-[#0B2925]/90 hover:text-[#A7F3D0]"
                >
                  Sign in <ChevronRight className="h-4 w-4" />
                </button>
              </motion.div>

              <motion.div
                variants={reveal}
                transition={{ duration: 0.35 }}
                className="mt-11 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-semibold text-[#F8F5F3]/90"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#A7F3D0]" /> Argon2id/bcrypt hashing
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#A7F3D0]" /> HttpOnly session cookies
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#A7F3D0]" /> Rate-limited logins
                </span>
              </motion.div>
            </motion.div>
          </div>
        </CampusHero>
      </div>

      {/* ================= 3D SCROLL-DRIVEN ARCH & CUTOUT ARENA ================= */}
      <div id="arena">
        <AuthFlowScrollArena />
      </div>

      {/* ================= METRICS & STATS BANNER ================= */}
      <section className="relative z-10 -mt-12 mx-auto max-w-6xl px-5 sm:px-8">
        <div
          className="grid overflow-hidden rounded-3xl border border-[#E5DDD8] bg-white shadow-[0_18px_52px_rgba(11,41,37,0.08)] sm:grid-cols-4 transition duration-300"
        >
          <div className="border-b border-[#F8F5F3] p-6 sm:border-b-0 sm:border-r">
            <p className="font-display text-3xl font-extrabold text-[#0B2925]">
              <Counter end={AUTH_CONFIG.BCRYPT_SALT_ROUNDS} prefix="bcrypt · " suffix=" rounds" />
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#755B73]">
              Password hash algorithm ({AUTH_CONFIG.HASH_ALGORITHM})
            </p>
          </div>
          <div className="border-b border-[#F8F5F3] p-6 sm:border-b-0 sm:border-r">
            <p className="font-display text-3xl font-extrabold text-[#0B2925]">
              <Counter end={AUTH_CONFIG.MAX_FAILED_LOGIN_ATTEMPTS} suffix=" attempts" />
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#755B73]">
              Max failed attempts before lockout
            </p>
          </div>
          <div className="border-b border-[#F8F5F3] p-6 sm:border-b-0 sm:border-r">
            <p className="font-display text-3xl font-extrabold text-[#0B2925]">
              <Counter end={AUTH_CONFIG.LOCKOUT_DURATION_MINUTES} suffix=" min" />
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#755B73]">
              Lockout duration upon threshold breach
            </p>
          </div>
          <div className="p-6">
            <p className="font-display text-3xl font-extrabold text-[#0B2925]">
              <Counter end={AUTH_CONFIG.SESSION_LIFETIME_HOURS} suffix=" hours" />
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#755B73]">
              HttpOnly session lifetime
            </p>
          </div>
        </div>
      </section>

      {/* ================= PLATFORM MODULES SECTION ================= */}
      <section id="features" className="mx-auto max-w-7xl px-5 pb-24 pt-28 sm:px-8">
        <div className="max-w-2xl">
          <p className="eyebrow text-[#755B73]">Fortified authentication engine</p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-[#27212B]">
            Security controls shaped around defense in depth.
          </h2>
          <p className="mt-4 text-base leading-7 text-[#524458]">
            Every layer from credential transmission to database storage enforces deterministic checks, preventing
            common web application vulnerabilities before requests reach sensitive handlers.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {platformCards.map(([Icon, title, body], index) => (
            <motion.article
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.28, delay: index * 0.06 }}
              key={title}
              className="group rounded-3xl border border-[#E5DDD8] bg-white p-6 shadow-[0_8px_24px_rgba(11,41,37,0.04)] transition duration-200 hover:-translate-y-1.5 hover:border-[#0B2925] hover:shadow-[0_20px_40px_rgba(11,41,37,0.12)]"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0B2925]/10 text-[#0B2925] transition duration-200 group-hover:bg-[#0B2925] group-hover:text-[#A7F3D0]">
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 font-display text-lg font-bold text-[#27212B]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#524458]">{body}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[#0B2925] transition group-hover:translate-x-1 group-hover:text-[#0B2925]">
                Explore module <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ================= WORKFLOW LIFECYCLE ================= */}
      <section id="workflow" className="border-y border-[#E5DDD8] bg-[#EBE5E2]/40">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="eyebrow text-[#755B73]">Authentication lifecycle</p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-[#27212B]">
              Make the next step unambiguous.
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-[#524458]">
              Users progress through a verified sequence. Credentials are authenticated with cryptographic rigor,
              sessions are safely established, and policy controls are checked before access is granted.
            </p>
            <Button
              onClick={() => setLocation("/dashboard")}
              className="mt-7 h-11 bg-[#0B2925] px-5 text-xs font-bold text-white shadow-md hover:bg-[#133D37]"
            >
              Preview dashboard <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="relative">
            <div className="absolute left-[23px] top-8 h-[calc(100%-64px)] w-0.5 bg-gradient-to-b from-[#0B2925] via-[#A7F3D0] to-[#E5DDD8]" />
            {[
              ["1", "Register", "validated and hashed"],
              ["2", "Sign in", "credentials verified, attempts counted"],
              ["3", "Session issued", "HttpOnly, SameSite cookie"],
              ["4", "Protected access", "middleware guards every private route"],
            ].map((step, index) => (
              <motion.div
                initial={{ opacity: 0, x: 14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.26, delay: index * 0.06 }}
                key={step[0]}
                className="relative flex gap-5 pb-7 last:pb-0"
              >
                <span
                  className={`relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-bold shadow-md ${
                    index === 0
                      ? "bg-[#0B2925] text-[#A7F3D0]"
                      : index === 1
                        ? "bg-[#133D37] text-white"
                        : index === 2
                          ? "bg-[#A7F3D0] text-[#0B2925]"
                          : "bg-white text-[#27212B] border border-[#E5DDD8]"
                  }`}
                >
                  {step[0]}
                </span>
                <div className="rounded-2xl border border-[#E5DDD8] bg-white px-5 py-4 shadow-sm">
                  <h3 className="font-bold text-[#27212B]">{step[1]}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#524458]">{step[2]}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SECURITY INSIGHTS CTA ================= */}
      <section id="security" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="rounded-[2.5rem] bg-gradient-to-br from-[#0B2925] via-[#103D37] to-[#1A4F47] p-8 sm:p-12 text-white shadow-[0_24px_70px_rgba(11,41,37,0.3)] lg:flex lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#A7F3D0]/40 bg-white/10 px-3 py-1 text-xs font-bold text-[#A7F3D0]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#A7F3D0]" /> Built for OWASP best practices
            </div>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white">
              Security you can actually explain.
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#F8F5F3]/90">
              Clear code, defensible architecture, and zero mystery abstractions. Built with industry-standard
              cryptographic primitives, rate limiting, and session hardening.
            </p>
          </div>
          <Button
            onClick={() => setLocation("/access")}
            className="mt-8 h-12 bg-[#A7F3D0] px-6 text-sm font-bold text-[#0B2925] shadow-lg transition hover:bg-[#86EFAC] lg:mt-0"
          >
            Open SecureAuth <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-[#E5DDD8] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <BrandMark />
          <p className="text-xs text-[#755B73]">
            SecureAuth · Secure Login System · Engineering Team
          </p>
        </div>
      </footer>
    </main>
  );
}
