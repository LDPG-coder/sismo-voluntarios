type ExternalOfficialGemProps = {
  className?: string;
};

export function ExternalOfficialGem({ className = "" }: ExternalOfficialGemProps) {
  return (
    <span
      title="Voluntariado oficial externo"
      aria-label="Voluntariado oficial externo"
      className={`pointer-events-none absolute left-1 top-1 z-20 inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-gradient-to-br from-emerald-300 to-emerald-600 shadow-[0_0_6px_rgba(16,185,129,0.7)] ring-1 ring-emerald-200/60 ${className}`}
    />
  );
}
