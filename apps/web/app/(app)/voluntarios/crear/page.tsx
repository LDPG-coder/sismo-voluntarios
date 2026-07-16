"use client";

import { useState } from "react";
import { ActivityTypeSelector } from "@/components/activity-type-selector";
import { CrearActivityClient } from "@/components/crear-activity-client";

type ActivityType = "proponer" | "oficial" | "realizada";

export default function CrearActivityPage() {
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);

  if (!selectedType) {
    return <ActivityTypeSelector onSelect={setSelectedType} />;
  }

  return <CrearActivityClient activityType={selectedType} onBack={() => setSelectedType(null)} />;
}
