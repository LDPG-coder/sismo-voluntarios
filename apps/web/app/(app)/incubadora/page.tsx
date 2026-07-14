// [INCUBADORA] Seccion desactivada temporalmente: no debe verse en prod.
// El codigo original de esta pagina esta en el historial de git. Para
// reactivar la Incubadora hay que restaurar estos archivos de ruta, la
// entrada de navegacion en components/nav-config.tsx, el "exclude" de
// components/incubadora en tsconfig.json, las dependencias tiptap en
// package.json y el router de backend (ver apps/api).
import { notFound } from "next/navigation";

export default function IncubadoraDisabled() {
  notFound();
}
