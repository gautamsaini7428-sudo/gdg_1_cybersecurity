type BrandMarkProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function BrandMark({ compact = false, inverse = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#0B2925] via-[#1A453F] to-[#A7F3D0] p-[1.5px] shadow-[0_4px_14px_rgba(11,41,37,0.35)]">
        <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#0B2925] text-white">
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
          >
            <path
              d="M16 3L27 9V23L16 29L5 23V9L16 3Z"
              stroke="#A7F3D0"
              strokeWidth="1.5"
              strokeLinejoin="round"
              className="opacity-75"
            />
            <path
              d="M11 12V18C11 19.6569 12.3431 21 14 21H18C19.6569 21 21 19.6569 21 18V12"
              stroke="#A7F3D0"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <path
              d="M16 8V14M13 14H19"
              stroke="#755B73"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <circle cx="16" cy="20" r="1.5" fill="#A7F3D0" />
          </svg>
        </div>
      </div>
      {!compact && (
        <div className={inverse ? "text-white" : "text-[#27212B]"}>
          <div className="flex items-center gap-1.5">
            <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] leading-none">
              SECURE <span className="text-[#A7F3D0]">·</span> AUTH
            </p>
          </div>
          <p
            className={`mt-1 text-[10px] font-semibold tracking-wide leading-none ${
              inverse ? "text-[#A7F3D0]/90" : "text-[#755B73]"
            }`}
          >
            Authentication System
          </p>
        </div>
      )}
    </div>
  );
}
