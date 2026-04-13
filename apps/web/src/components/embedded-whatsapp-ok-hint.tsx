export function EmbeddedWhatsAppOkHint() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative mx-auto h-24 w-full max-w-lg overflow-visible"
    >
      <div className="absolute left-2 top-1 h-24 w-40 text-emerald-500 drop-shadow-[0_10px_20px_rgba(16,185,129,0.22)]">
        <svg
          className="h-full w-full"
          fill="none"
          viewBox="0 0 180 120"
        >
          <defs>
            <linearGradient id="ok-arrow-gradient" x1="18" x2="142" y1="20" y2="114">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <path
            d="M138 108C125 92 114 78 100 64C84 48 64 32 26 12"
            stroke="url(#ok-arrow-gradient)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="8"
          />
          <path
            d="M40 8L18 10L30 30"
            stroke="url(#ok-arrow-gradient)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="8"
          />
          <path
            d="M138 108C126 95 116 84 107 74"
            stroke="#a7f3d0"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        </svg>
      </div>
    </div>
  );
}
