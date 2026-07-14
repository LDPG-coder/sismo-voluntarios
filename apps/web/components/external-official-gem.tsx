type ExternalOfficialGemProps = {
  className?: string;
  label?: string;
};

// Gema que marca las actividades que suman horas: voluntariado externo oficial y
// voluntariado interno. Mantiene el mismo color esmeralda para ambas.
export function ExternalOfficialGem({
  className = "",
  label = "Voluntariado que suma horas",
}: ExternalOfficialGemProps) {
  return (
    <svg
      viewBox="0 0 192 192"
      fill="currentColor"
      className={`pointer-events-none absolute left-1 top-1 z-20 h-3.5 w-3.5 text-emerald-500 drop-shadow-[0_0_4px_rgba(16,185,129,0.6)] dark:text-emerald-400 ${className}`}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <path
        fillRule="evenodd"
        d="M113.267 17.073a6 6 0 0 1 7.65 1.994l27.365 40.29a6.004 6.004 0 0 1 .938 4.456l-17.75 96.424a6.008 6.008 0 0 1-.614 1.75l-5.615 10.465a6 6 0 0 1-7.159 2.864l-40.966-13.455a5.998 5.998 0 0 1-3.623-3.292L43.896 91.043a6 6 0 0 1 .075-4.981l20.462-43.107a6 6 0 0 1 2.733-2.792l46.101-23.09Zm-46.804 49.59-10.477 22.07 14.724 33.593-3.134-46.802-1.113-8.861Zm15.11 38.283 3.132 46.777 23.595 7.75-26.727-54.527Zm38.451 51.181 16.637-90.375-24.142-14.339-31.464 25.212 38.969 79.502ZM78.167 63.561l28.341-22.708 1.394-7.672-31.566 15.81 1.831 14.57Zm41.066-25.616-.574 3.158 4.558 2.707-3.984-5.865Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
