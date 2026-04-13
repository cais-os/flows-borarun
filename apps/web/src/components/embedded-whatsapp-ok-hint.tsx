export function EmbeddedWhatsAppOkHint() {
  return (
    <>
      <style>
        {`@keyframes ok-nudge {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-3px, -3px); }
        }`}
      </style>
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-white px-4 py-3">
        <div
          className="shrink-0"
          style={{ animation: "ok-nudge 1.5s ease-in-out infinite" }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-emerald-500"
          >
            <path
              d="M7 17V7h10"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 7l10 10"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="text-[13px] leading-snug text-slate-600">
          Para voltar ao chat, clique no{" "}
          <span className="inline-flex items-center rounded-md bg-emerald-100/80 px-1.5 py-0.5 text-xs font-bold text-emerald-700">
            OK
          </span>{" "}
          no canto superior esquerdo
        </p>
      </div>
    </>
  );
}
