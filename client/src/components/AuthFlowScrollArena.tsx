import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Layers, Sparkles, ChevronDown } from "lucide-react";

export default function AuthFlowScrollArena() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Short, content-matched scroll progress across the pinned track (130vh total track)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Smooth single-blueprint scrub: zooms/elevates subtly into focus
  const lineZ = useTransform(scrollYProgress, [0, 1], [-180, prefersReducedMotion ? 0 : 80]);
  const lineScale = useTransform(scrollYProgress, [0, 1], [0.94, prefersReducedMotion ? 1 : 1.06]);
  const lineRotateX = useTransform(scrollYProgress, [0, 1], [6, -2]);

  return (
    <section
      id="arena"
      ref={containerRef}
      className="relative h-[130vh] bg-[#0B2925] text-white"
    >
      {/* Sticky Viewport Window */}
      <div className="sticky top-0 flex h-screen w-full flex-col items-center justify-center overflow-hidden [perspective:1200px]">
        {/* Ambient Deep Forest Green Backing */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(167,243,208,0.14)_0%,rgba(11,41,37,0.98)_75%)]" />

        {/* Dynamic Mint Blueprint Grid Floor */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(167,243,208,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(167,243,208,0.4) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            transform: "perspective(500px) rotateX(65deg) translateY(50px)",
            transformOrigin: "bottom center",
          }}
        />

        {/* Top Header Overlay */}
        <div className="absolute top-8 z-30 flex flex-col items-center text-center px-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#A7F3D0]/40 bg-[#0B2925]/85 px-4 py-1 text-xs font-bold text-[#A7F3D0] shadow-lg backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-[#A7F3D0]" />
            <span>Security Architecture Diagram</span>
          </div>
          <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-4xl text-white">
            Inside the <span className="text-[#A7F3D0]">Auth Flow</span>
          </h2>
          <p className="mt-1 text-xs text-[#F8F5F3]/85 sm:text-sm max-w-xl">
            End-to-end request lifecycle from client payload sanitization to session token issuance
          </p>
        </div>

        {/* SINGLE BLUEPRINT CARD VIEW */}
        <div className="relative flex h-[500px] w-full max-w-5xl items-center justify-center [transform-style:preserve-3d] pt-8">
          <motion.div
            className="flex flex-col items-center justify-center [transform-style:preserve-3d]"
            style={{
              z: lineZ,
              scale: lineScale,
              rotateX: lineRotateX,
            }}
          >
            <div className="image-light-up relative overflow-hidden rounded-3xl border-2 border-[#A7F3D0]/70 bg-[#061A17]/95 p-3 shadow-[0_0_50px_rgba(167,243,208,0.2)]">
              {/* Inline SVG Authentication Flow Diagram */}
              <svg
                viewBox="0 0 780 390"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-[320px] w-[580px] rounded-2xl sm:h-[390px] sm:w-[780px] bg-[#071F1B]"
              >
                {/* Background CAD Blueprint Grid */}
                <defs>
                  <pattern id="cadGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#A7F3D0" strokeWidth="0.5" strokeOpacity="0.12" />
                  </pattern>
                  <linearGradient id="mintGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.3" />
                    <stop offset="50%" stopColor="#A7F3D0" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#A7F3D0" stopOpacity="0.3" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                <rect width="780" height="390" fill="#061A17" />
                <rect width="780" height="390" fill="url(#cadGrid)" />

                {/* Sub-header tech markers */}
                <text x="35" y="45" fill="#A7F3D0" opacity="0.6" fontSize="10" fontFamily="monospace" letterSpacing="0.15em">
                  PIPELINE :: OWASP ASVS 4.0 :: V2 AUTHENTICATION VERIFICATION
                </text>
                <text x="745" y="45" textAnchor="end" fill="#A7F3D0" opacity="0.6" fontSize="10" fontFamily="monospace">
                  LATENCY &lt; 28ms [ROBUST]
                </text>

                {/* Main Data Flow Bus Lines */}
                <path
                  d="M 105 185 L 225 185 M 225 185 L 345 185 M 345 185 L 465 185 M 465 185 L 585 185 M 585 185 L 705 185"
                  stroke="#A7F3D0"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.4"
                />

                {/* Continuous Glowing Signal Line */}
                <path
                  d="M 75 185 L 705 185"
                  stroke="url(#mintGlow)"
                  strokeWidth="1.5"
                  opacity="0.85"
                />

                {/* Flow Direction Indicator Chevrons */}
                <path d="M 160 181 L 166 185 L 160 189" stroke="#A7F3D0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 280 181 L 286 185 L 280 189" stroke="#A7F3D0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 400 181 L 406 185 L 400 189" stroke="#A7F3D0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 520 181 L 526 185 L 520 189" stroke="#A7F3D0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 640 181 L 646 185 L 640 189" stroke="#A7F3D0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                {/* ================= STAGE 1: Client ================= */}
                <g transform="translate(35, 125)">
                  <rect width="90" height="120" rx="14" fill="#0B2925" stroke="#A7F3D0" strokeWidth="1.5" />
                  <rect x="2" y="2" width="86" height="24" rx="12" fill="#133D37" />
                  <text x="45" y="18" textAnchor="middle" fill="#A7F3D0" fontSize="10" fontWeight="bold" fontFamily="monospace">01 · REQ</text>
                  <circle cx="45" cy="55" r="14" fill="#061A17" stroke="#A7F3D0" strokeWidth="1.5" />
                  {/* User Icon */}
                  <circle cx="45" cy="51" r="4.5" fill="#A7F3D0" />
                  <path d="M 37 63 C 37 58 53 58 53 63" stroke="#A7F3D0" strokeWidth="1.5" fill="none" />
                  <text x="45" y="86" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="bold">Client</text>
                  <text x="45" y="103" textAnchor="middle" fill="#A7F3D0" opacity="0.8" fontSize="8.5" fontFamily="monospace">POST /login</text>
                </g>

                {/* ================= STAGE 2: Validate ================= */}
                <g transform="translate(155, 125)">
                  <rect width="90" height="120" rx="14" fill="#0B2925" stroke="#A7F3D0" strokeWidth="1.5" />
                  <rect x="2" y="2" width="86" height="24" rx="12" fill="#133D37" />
                  <text x="45" y="18" textAnchor="middle" fill="#A7F3D0" fontSize="10" fontWeight="bold" fontFamily="monospace">02 · CHECK</text>
                  <circle cx="45" cy="55" r="14" fill="#061A17" stroke="#A7F3D0" strokeWidth="1.5" />
                  {/* Check/Form Icon */}
                  <path d="M 39 55 L 43 59 L 51 51" stroke="#A7F3D0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <text x="45" y="86" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="bold">Validate</text>
                  <text x="45" y="103" textAnchor="middle" fill="#A7F3D0" opacity="0.8" fontSize="8.5" fontFamily="monospace">Zod Schema</text>
                </g>

                {/* ================= STAGE 3: Rate limit ================= */}
                <g transform="translate(275, 125)">
                  <rect width="90" height="120" rx="14" fill="#0B2925" stroke="#A7F3D0" strokeWidth="1.5" />
                  <rect x="2" y="2" width="86" height="24" rx="12" fill="#133D37" />
                  <text x="45" y="18" textAnchor="middle" fill="#A7F3D0" fontSize="10" fontWeight="bold" fontFamily="monospace">03 · GUARD</text>
                  <circle cx="45" cy="55" r="14" fill="#061A17" stroke="#A7F3D0" strokeWidth="1.5" />
                  {/* Shield / Speed Meter Icon */}
                  <path d="M 38 49 L 45 46 L 52 49 V 56 C 52 61 45 64 45 64 C 45 64 38 61 38 56 Z" stroke="#A7F3D0" strokeWidth="1.5" fill="none" />
                  <text x="45" y="86" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="bold">Rate limit</text>
                  <text x="45" y="103" textAnchor="middle" fill="#A7F3D0" opacity="0.8" fontSize="8.5" fontFamily="monospace">Max 5 Attempts</text>
                </g>

                {/* ================= STAGE 4: Verify hash ================= */}
                <g transform="translate(395, 125)">
                  <rect width="90" height="120" rx="14" fill="#0B2925" stroke="#A7F3D0" strokeWidth="1.75" filter="url(#glow)" />
                  <rect x="2" y="2" width="86" height="24" rx="12" fill="#1A4F47" />
                  <text x="45" y="18" textAnchor="middle" fill="#A7F3D0" fontSize="10" fontWeight="bold" fontFamily="monospace">04 · CRYPTO</text>
                  <circle cx="45" cy="55" r="14" fill="#061A17" stroke="#A7F3D0" strokeWidth="1.5" />
                  {/* Key / Hash Lock Icon */}
                  <circle cx="43" cy="53" r="3.5" stroke="#A7F3D0" strokeWidth="1.5" />
                  <path d="M 46 56 L 51 61 M 49 59 L 52 56" stroke="#A7F3D0" strokeWidth="1.5" strokeLinecap="round" />
                  <text x="45" y="86" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="bold">Verify hash</text>
                  <text x="45" y="103" textAnchor="middle" fill="#A7F3D0" opacity="0.9" fontSize="8.5" fontFamily="monospace">Argon2id / bcrypt</text>
                </g>

                {/* ================= STAGE 5: Issue session ================= */}
                <g transform="translate(515, 125)">
                  <rect width="90" height="120" rx="14" fill="#0B2925" stroke="#A7F3D0" strokeWidth="1.5" />
                  <rect x="2" y="2" width="86" height="24" rx="12" fill="#133D37" />
                  <text x="45" y="18" textAnchor="middle" fill="#A7F3D0" fontSize="10" fontWeight="bold" fontFamily="monospace">05 · TOKEN</text>
                  <circle cx="45" cy="55" r="14" fill="#061A17" stroke="#A7F3D0" strokeWidth="1.5" />
                  {/* Cookie / Ticket Icon */}
                  <rect x="38" y="50" width="14" height="10" rx="2" stroke="#A7F3D0" strokeWidth="1.5" fill="none" />
                  <line x1="41" y1="55" x2="49" y2="55" stroke="#A7F3D0" strokeWidth="1.5" strokeDasharray="1 2" />
                  <text x="45" y="86" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="bold">Issue session</text>
                  <text x="45" y="103" textAnchor="middle" fill="#A7F3D0" opacity="0.8" fontSize="8.5" fontFamily="monospace">HttpOnly Cookie</text>
                </g>

                {/* ================= STAGE 6: Protected route ================= */}
                <g transform="translate(635, 125)">
                  <rect width="90" height="120" rx="14" fill="#0B2925" stroke="#A7F3D0" strokeWidth="1.5" />
                  <rect x="2" y="2" width="86" height="24" rx="12" fill="#133D37" />
                  <text x="45" y="18" textAnchor="middle" fill="#A7F3D0" fontSize="10" fontWeight="bold" fontFamily="monospace">06 · ACCESS</text>
                  <circle cx="45" cy="55" r="14" fill="#061A17" stroke="#A7F3D0" strokeWidth="1.5" />
                  {/* Protected Door / Shield Icon */}
                  <path d="M 40 48 H 50 V 62 H 40 Z" stroke="#A7F3D0" strokeWidth="1.5" fill="none" />
                  <circle cx="47" cy="55" r="1" fill="#A7F3D0" />
                  <text x="45" y="86" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold">Protected route</text>
                  <text x="45" y="103" textAnchor="middle" fill="#A7F3D0" opacity="0.8" fontSize="8.5" fontFamily="monospace">Auth Guard OK</text>
                </g>

                {/* Lower telemetry bar */}
                <path d="M 35 285 L 745 285" stroke="#A7F3D0" strokeWidth="1" strokeOpacity="0.25" />
                <g transform="translate(35, 305)">
                  <circle cx="6" cy="6" r="3" fill="#A7F3D0" />
                  <text x="16" y="9" fill="#A7F3D0" fontSize="10" fontFamily="monospace">STATE: VERIFIED ACTIVE</text>
                  <text x="210" y="9" fill="#F8F5F3" opacity="0.75" fontSize="10" fontFamily="monospace">SAME-SITE: LAX / STRICT</text>
                  <text x="390" y="9" fill="#F8F5F3" opacity="0.75" fontSize="10" fontFamily="monospace">HASH: ARGON2ID</text>
                  <text x="540" y="9" fill="#A7F3D0" opacity="0.9" fontSize="10" fontFamily="monospace">ZERO-TRUST PERIMETER</text>
                </g>
              </svg>

              {/* Glowing Mint Laser Scanline Effect */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#A7F3D0]/15 to-transparent opacity-60" />

              {/* Frame Corner Accents */}
              <div className="absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-[#A7F3D0]" />
              <div className="absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-[#A7F3D0]" />
              <div className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-[#A7F3D0]" />
              <div className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-[#A7F3D0]" />

              {/* Bottom HUD Badges */}
              <div className="absolute bottom-6 left-7 flex items-center gap-2 rounded-xl bg-[#0B2925]/90 border border-[#A7F3D0]/40 px-3.5 py-1.5 text-[11px] font-bold text-[#A7F3D0] backdrop-blur-md">
                <Layers className="h-3.5 w-3.5 text-[#A7F3D0]" />
                <span>AUTH FLOW · REQUEST LIFECYCLE</span>
              </div>
              <div className="absolute bottom-6 right-7 rounded-xl bg-[#0B2925]/90 border border-[#A7F3D0]/40 px-3 py-1.5 text-[10px] font-mono font-bold text-[#F8F5F3]/90 backdrop-blur-md">
                <span>OWASP ASVS · LEVEL 1</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Unpin Indicator */}
        <div className="absolute bottom-6 z-30 flex items-center gap-2 text-xs font-semibold text-[#A7F3D0]/90">
          <span>Scroll into Security Modules</span>
          <ChevronDown className="h-4 w-4 animate-bounce text-[#A7F3D0]" />
        </div>
      </div>
    </section>
  );
}
