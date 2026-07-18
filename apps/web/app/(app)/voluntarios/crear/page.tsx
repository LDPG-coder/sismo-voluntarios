"use client";

import { useState } from "react";
import { ActivityTypeSelector } from "@/components/activity-type-selector";
import { CrearActivityClient } from "@/components/crear-activity-client";
import { PageGuide } from "@/components/page-guide";

type ActivityType = "proponer" | "oficial" | "realizada";

export default function CrearActivityPage() {
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);

  const guide = (
    <PageGuide id="crear" title="Crear una actividad">
      Elige el tipo y completa el formulario. Las actividades{" "}
      <strong>internas</strong> suman horas al programa; las{" "}
      <strong>oficiales</strong> las valida la coordinación SEP; las{" "}
      <strong>realizadas</strong> sirven para registrar horas ya cumplidas.
    </PageGuide>
  );

  if (!selectedType) {
    return (
      <>
        {guide}
        <ActivityTypeSelector onSelect={setSelectedType} />
      </>
    );
  }

  return (
    <>
      {guide}
      <CrearActivityClient activityType={selectedType} onBack={() => setSelectedType(null)} />
    </>
  );
}
