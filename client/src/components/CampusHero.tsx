import { useEffect, useRef, useState, type ReactNode } from "react";

// Easily swap background asset here
const HERO_BG_IMAGE = "/images/auth_hero_bg.png";

type CampusHeroProps = {
  children?: ReactNode;
};

export default function CampusHero({ children }: CampusHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const parallaxBgRef = useRef<HTMLDivElement>(null);

  // Mouse & animation tracking
  const targetPos = useRef({ x: 0, y: 0, active: false });
  const currentPos = useRef({ x: 0, y: 0, opacity: 0 });
  const parallaxPos = useRef({ x: 0, y: 0 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Detect touch device or reduced motion preference
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setIsTouchDevice(touch || reducedMotion);

    if (touch || reducedMotion) return;

    let animationFrameId: number;

    const animate = () => {
      // Smooth interpolation (lerp) for spotlight position and opacity
      const lerpFactor = 0.08;
      const targetOpacity = targetPos.current.active ? 1 : 0;

      currentPos.current.x += (targetPos.current.x - currentPos.current.x) * lerpFactor;
      currentPos.current.y += (targetPos.current.y - currentPos.current.y) * lerpFactor;
      currentPos.current.opacity += (targetOpacity - currentPos.current.opacity) * lerpFactor;

      // Parallax smooth interpolation
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const normX = (currentPos.current.x / rect.width - 0.5) * 2; // -1 to 1
        const normY = (currentPos.current.y / rect.height - 0.5) * 2; // -1 to 1
        const targetParallaxX = targetPos.current.active ? normX * -10 : 0;
        const targetParallaxY = targetPos.current.active ? normY * -8 : 0;

        parallaxPos.current.x += (targetParallaxX - parallaxPos.current.x) * 0.05;
        parallaxPos.current.y += (targetParallaxY - parallaxPos.current.y) * 0.05;

        if (parallaxBgRef.current) {
          parallaxBgRef.current.style.transform = `translate3d(${parallaxPos.current.x.toFixed(2)}px, ${parallaxPos.current.y.toFixed(2)}px, 0) scale(1.05)`;
        }
      }

      const x = currentPos.current.x.toFixed(1);
      const y = currentPos.current.y.toFixed(1);
      const opacity = currentPos.current.opacity.toFixed(3);

      // Update spotlight mask and mint photon glow
      if (spotlightRef.current) {
        spotlightRef.current.style.opacity = opacity;
        spotlightRef.current.style.webkitMaskImage = `radial-gradient(circle 260px at ${x}px ${y}px, rgba(0,0,0,1) 0%, rgba(0,0,0,0.65) 45%, transparent 100%)`;
        spotlightRef.current.style.maskImage = `radial-gradient(circle 260px at ${x}px ${y}px, rgba(0,0,0,1) 0%, rgba(0,0,0,0.65) 45%, transparent 100%)`;
      }

      if (glowRef.current) {
        glowRef.current.style.opacity = opacity;
        glowRef.current.style.background = `radial-gradient(circle 280px at ${x}px ${y}px, rgba(167,243,208,0.16) 0%, rgba(167,243,208,0.04) 50%, transparent 100%)`;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isTouchDevice) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    targetPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    };
  };

  const handlePointerLeave = () => {
    targetPos.current.active = false;
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative min-h-[860px] w-full overflow-hidden bg-[#071D1A]"
    >
      {/* ================= LAYER 1: BASE PHOTOGRAPH + FOREST GREEN VIGNETTE ================= */}
      <div
        ref={parallaxBgRef}
        className="absolute inset-0 h-full w-full will-change-transform pointer-events-none transition-transform duration-300 ease-out"
        style={{ transform: "translate3d(0, 0, 0) scale(1.05)" }}
      >
        <img
          src={HERO_BG_IMAGE}
          alt="SecureAuth Architecture Overview"
          className="h-full w-full object-cover object-[center_35%] filter brightness-[0.72] contrast-[1.08] saturate-[0.95]"
        />

        {/* Sophisticated Dark Green / Black Gradient Overlays */}
        {/* 1. Deep Top-to-Bottom Atmosphere */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,29,26,0.85)_0%,rgba(11,41,37,0.58)_40%,rgba(7,29,26,0.94)_100%)]" />

        {/* 2. Left-to-Right Typography Protection Shield */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,29,26,0.92)_0%,rgba(11,41,37,0.55)_52%,rgba(7,29,26,0.78)_100%)]" />

        {/* 3. Subtle Institutional Blueprint CAD Grid Texture */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(167,243,208,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(167,243,208,0.3) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* ================= LAYER 2: SPOTLIGHT REVEAL (BRIGHTER REAL PHOTOGRAPH) ================= */}
      {!isTouchDevice && (
        <div
          ref={spotlightRef}
          className="pointer-events-none absolute inset-0 z-1 h-full w-full will-change-[mask-image,opacity] opacity-0 transition-opacity duration-200"
        >
          <img
            src={HERO_BG_IMAGE}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-[center_35%] filter brightness-[1.12] contrast-[1.14] saturate-[1.12]"
          />
          {/* Lighter Green Wash inside illuminated area */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,41,37,0.35)_0%,rgba(11,41,37,0.18)_50%,rgba(11,41,37,0.5)_100%)]" />
        </div>
      )}

      {/* ================= LAYER 3: MINT PHOTON GLOW OVERLAY ================= */}
      {!isTouchDevice && (
        <div
          ref={glowRef}
          className="pointer-events-none absolute inset-0 z-2 h-full w-full opacity-0 will-change-[background,opacity] transition-opacity duration-200"
        />
      )}

      {/* ================= LAYER 4: HERO CONTENT (Typography, Buttons, Nav) ================= */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
