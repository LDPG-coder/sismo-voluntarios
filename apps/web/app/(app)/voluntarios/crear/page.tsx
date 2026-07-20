"use client";

import { useState } from "react";
import { ActivityTypeSelector } from "@/components/activity-type-selector";
import { CrearActivityClient } from "@/components/crear-activity-client";
import { PageGuide } from "@/components/page-guide";

type ActivityType = "proponer" | "realizada";

export default function CrearActivityPage() {
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);

  const guide = (
      <PageGuide id="crear" title="Crear una actividad">
        Las actividades <strong>internas</strong> suman horas al programa.
        Las actividades realizadas se registran como privadas.
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
