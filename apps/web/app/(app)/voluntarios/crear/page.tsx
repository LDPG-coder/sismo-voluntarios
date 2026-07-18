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
        Como es usualmente, las actividades <strong>internas</strong> suman horas
        al programa y las <strong>oficiales</strong> tienen que ser validadas con
        una planilla emitida por quien supervisó la actividad. Pero de momento
        todas las actividades podrán sumar horas de voluntariado.
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
