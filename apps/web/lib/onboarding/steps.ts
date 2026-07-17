export type TourStep = {
  /** CSS selector (data-tour) del elemento a resaltar. Si se omite, el tooltip
   *  se muestra centrado (p.ej. pantallas de bienvenida/despedida). */
  selector?: string;
  title: string;
  body: string;
};

export const ONBOARDING_STEPS: TourStep[] = [
  {
    title: "\u00a1Bienvenido a Sismo Voluntarios! \ud83d\udc4b",
    body: "Te mostramos en 1 min\u00f3tico c\u00f3mo funciona la app y d\u00f3nde encontrar cada secci\u00f3n. Usa \u201cSiguiente\u201d para avanzar o \u201cSaltar\u201d para salir.",
  },
  {
    selector: '[data-tour="feed"]',
    title: "1/5 \u00b7 Descubre actividades",
    body: "Esta es la secci\u00f3n \u201cVoluntarios\u201d: el feed donde ves las actividades publicadas por otros voluntarios en tu zona. Explora y encuentra d\u00f3nde ayudar.",
  },
  {
    selector: '[data-tour="demo-post"]',
    title: "2/5 \u00b7 Publicaciones de ejemplo",
    body: "Las tarjetas marcadas como \u201cEjemplo \u00b7 temporal\u201d las pusimos para que practiques. Desaparecer\u00e1n solas en unos d\u00edas. Pulsa \u201cUnirme\u201d para inscribirte y reservar tu cupo.",
  },
  {
    selector: '[data-tour="header-crear"]',
    title: "3/5 \u00b7 Crear (ofrecer)",
    body: "\u00bfTienes una actividad para proponer? Pulsa \u201c+\u201d para publicar tu propia actividad (venta de comida, jornada, limpieza, etc.) y sumar horas al programa.",
  },
  {
    selector: '[data-tour="nav-mis-actividades"]',
    title: "4/5 \u00b7 Mis actividades",
    body: "Tu panel de control. Tiene tres pesta\u00f1as: \u201cCreadas\u201d (las que publicaste), \u201cInscritas\u201d (donde te anotaste) y \u201cCedidos\u201d (cupos que diste a otro becario).",
  },
  {
    selector: '[data-tour="header-notif"]',
    title: "5/5 \u00b7 Notificaciones y perfil",
    body: "La campana \ud83d\udd14 te avisa de inscripciones, cesiones aceptadas y novedades. El avatar abre tu perfil y configuraci\u00f3n.",
  },
  {
    selector: '[data-tour="header-perfil"]',
    title: "Tu perfil",
    body: "Completa tu perfil para que otros voluntarios y coordinadores te reconozcan.",
  },
  {
    title: "\u00a1Listo! \ud83c\udf89",
    body: "Ya conoces todas las secciones: Voluntarios (feed), Crear (+), Mis actividades (Creadas/Inscritas/Cedidos), Notificaciones y Perfil. Para repetir el tour pulsa \u201c?\u201d.",
  },
];
