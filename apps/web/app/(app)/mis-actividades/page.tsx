import { requireSession } from "@/lib/auth/require-session";
import { MisActividadesClient } from "@/components/mis-actividades-client";
import { PageGuide } from "@/components/page-guide";

export default async function MisActividadesPage() {
  await requireSession();
  return (
    <>
      <PageGuide id="mis-actividades" title="Mis actividades">
        Tres pestañas: <strong>Creadas</strong> (las que publicaste),{" "}
        <strong>Inscritas</strong> (donde te anotaste) y <strong>Cedidos</strong>{" "}
        (cupos que diste a otro becario).
      </PageGuide>
      <MisActividadesClient />
    </>
  );
}
