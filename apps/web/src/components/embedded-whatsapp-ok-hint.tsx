type EmbeddedWhatsAppOkHintProps = {
  message: string;
};

export function EmbeddedWhatsAppOkHint({
  message,
}: EmbeddedWhatsAppOkHintProps) {
  return (
    <div className="relative mx-auto flex w-full max-w-lg items-start px-2 pt-2">
      <div className="pointer-events-none absolute left-0 top-0 h-24 w-28 text-emerald-400">
        <svg
          aria-hidden="true"
          className="h-full w-full"
          fill="none"
          viewBox="0 0 140 110"
        >
          <path
            d="M104 98C88 76 76 57 62 42C52 31 40 23 24 18"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="8"
          />
          <path
            d="M24 18L42 18"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="8"
          />
          <path
            d="M24 18L32 36"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="8"
          />
        </svg>
      </div>
      <div className="ml-20 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm shadow-emerald-100/80">
        <p className="text-sm font-medium leading-6 text-emerald-950">
          {message}
        </p>
      </div>
    </div>
  );
}
