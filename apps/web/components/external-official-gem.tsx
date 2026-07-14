type ExternalOfficialGemProps = {
  className?: string;
};

export function ExternalOfficialGem({ className = "" }: ExternalOfficialGemProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
      className={`pointer-events-none absolute left-1 top-1 z-20 h-3 w-3 text-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)] dark:text-emerald-400 ${className}`}
      role="img"
      aria-label="Voluntariado oficial externo"
    >
      <title>Voluntariado oficial externo</title>
      <path d="M12 2 L22 12 L12 22 L2 12 Z" />
      <path d="M12 7 L17 12 L12 17 L7 12 Z" />
      <path d="M12 2 L12 22" />
    </svg>
  );
}
