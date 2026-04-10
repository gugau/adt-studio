export function Splashscreen() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex animate-[splash-fade-in-up_0.6s_ease_both] flex-col items-center gap-5">
        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <rect x="10" y="8" width="36" height="46" rx="4" fill="#e2e8f0" />
          <path d="M38 8 L46 8 L46 16 Z" fill="#f8fafc" />
          <rect x="38" y="8" width="8" height="8" rx="1" fill="#cbd5e1" />
          <rect x="16" y="22" width="22" height="2.5" rx="1.25" fill="#3b82f6" opacity="0.9" />
          <rect x="16" y="29" width="16" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.8" />
          <rect x="16" y="36" width="19" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.8" />
          <path d="M50 36 L60 36" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
          <path
            d="M56 31 L61 36 L56 41"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="52" y="44" width="18" height="22" rx="3" fill="#3b82f6" />
          <rect x="54" y="47" width="14" height="2" rx="1" fill="#ffffff" opacity="0.9" />
          <rect x="54" y="51" width="10" height="2" rx="1" fill="#ffffff" opacity="0.6" />
          <rect x="54" y="55" width="12" height="2" rx="1" fill="#ffffff" opacity="0.6" />
          <circle cx="29" cy="54" r="10" fill="#dbeafe" />
          <circle cx="29" cy="50" r="2.5" fill="#3b82f6" opacity="0.9" />
          <path
            d="M24 57 Q29 52 34 57"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />
          <path
            d="M26 57 L25 63 M32 57 L33 63"
            stroke="#3b82f6"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.9"
          />
        </svg>
        <div>
          <div className="text-center text-[15px] font-semibold uppercase tracking-[0.18em] text-slate-900">
            ADT Studio
          </div>
          <div className="mt-1 text-center text-[11px] font-normal uppercase tracking-[0.12em] text-slate-400">
            Accessible Digital Textbooks
          </div>
        </div>
      </div>
      <div className="absolute bottom-9 left-0 right-0 flex animate-[splash-fade-in-up_0.6s_ease_0.3s_both] flex-col items-center gap-2.5">
        <div className="text-[11px] font-normal uppercase tracking-[0.1em] text-slate-400 animate-[splash-status-pulse_1.8s_ease-in-out_infinite]">
          Starting
        </div>
        <div className="h-0.5 w-40 overflow-hidden rounded-sm bg-slate-200">
          <div className="h-full rounded-sm bg-blue-500 animate-[splash-progress_2.4s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  )
}
