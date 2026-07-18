export const ZONES = [
  "Caracas",
  "Guatire",
  "Guarenas",
  "La Guaira",
  "Caucagua",
  "Los Teques",
  "El Junquito",
] as const;

export type ZoneName = (typeof ZONES)[number];
