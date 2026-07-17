export type TourStep = {
  /** CSS selector (data-tour) del elemento a resaltar. Si se omite, el tooltip
   *  se muestra centrado (p.ej. pantallas de bienvenida/despedida). */
  selector?: string;
  title: string;
  body: string;
};

export const ONBOARDING_STEPS: TourStep[] = [
  {
    title: "¡Bienvenido a Sismo Voluntarios! 👋",
    body: "Te mostramos en 1 minuto cómo funciona la app. Usa “Siguiente” para avanzar o “Saltar” para salir.",
  },
  {
    selector: '[data-tour="feed"]',
    title: "Descubre actividades",
    body: "Aquí ves las actividades publicadas por otros voluntarios en tu zona. Explora y encuentra dónde ayudar.",
  },
  {
    selector: '[data-tour="demo-post"]',
    title: "Publicaciones de ejemplo",
    body: "Las tarjetas marcadas como “Ejemplo · temporal” las pusimos para que practiques. Desaparecerán solas en unos días.",
  },
  {
    selector: '[data-tour="header-crear"]',
    title: "Vender / Ofrecer (Crear)",
    body: "¿Tienes una actividad para proponer? Pulsa “+” para publicar tu propia actividad y sumar horas al programa.",
  },
  {
    selector: '[data-tour="demo-post"]',
    title: "Recibir / Participar (Unirme)",
    body: "Para participar en una actividad, pulsa “Unirme” en la publicación. Así te inscribes y reservas tu cupo.",
  },
  {
    selector: '[data-tour="nav-mis-actividades"]',
    title: "Mis actividades",
    body: "En “Mis actividades” verás lo que creaste y en lo que te inscribiste: tu panel de control.",
  },
  {
    selector: '[data-tour="header-perfil"]',
    title: "Tu perfil",
    body: "Completa tu perfil para que otros voluntarios y coordinadores te reconozcan.",
  },
  {
    title: "¡Listo! 🎉",
    body: "Ya sabes vender (crear) y recibir (inscribirte). Cuando quieras repetir el tour, pulsa “?”.",
  },
];
