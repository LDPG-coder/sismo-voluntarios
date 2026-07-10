"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Activity = {
  id: string;
  max_participants: number | null;
  member_count: number;
};

type User = { id: string } | null;

export function JoinButton({ activity, user }: { activity: Activity; user: User }) {
  const [status, setStatus] = useState<"loading" | "idle" | "done" | "left">("loading");
  const [memberCount, setMemberCount] = useState(activity.member_count);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    if (!user) {
      setStatus("idle");
      return;
    }

    fetch(`${API}/api/v1/activities/${activity.id}/membership`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : { is_member: false }))
      .then((data) => {
        setStatus(data.is_member ? "done" : "idle");
      })
      .catch(() => {
        setStatus("idle");
      });
  }, [activity.id, user, API]);

  const spotsLeft =
    activity.max_participants != null ? activity.max_participants - memberCount : null;

  if (!user) {
    return (
      <p className="text-sm text-slate-500">
        Inicia sesion para unirte a esta actividad.
      </p>
    );
  }

  if (status === "loading") {
    return <Skeleton className="h-9 w-24 rounded-md" />;
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-emerald-700">Inscrito</span>
        <button
          onClick={async () => {
            setStatus("loading");
            await fetch(`${API}/api/v1/activities/${activity.id}/leave`, {
              method: "POST",
              credentials: "include",
            });
            setMemberCount((c) => c - 1);
            setStatus("left");
          }}
          className="text-xs text-slate-500 underline hover:text-slate-700"
        >
          Abandonar
        </button>
      </div>
    );
  }

  if (status === "left") {
    return (
      <button
        onClick={async () => {
          setStatus("loading");
          const res = await fetch(`${API}/api/v1/activities/${activity.id}/join`, {
            method: "POST",
            credentials: "include",
          });
          if (res.ok) {
            setMemberCount((c) => c + 1);
            setStatus("done");
          }
        }}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 dark:bg-emerald-500 dark:text-white"
      >
        Unirme
      </button>
    );
  }

  if (spotsLeft != null && spotsLeft <= 0) {
    return (
      <button disabled className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 dark:bg-slate-800">
        Cupos agotados
      </button>
    );
  }

  return (
    <button
      onClick={async () => {
        setStatus("loading");
        const res = await fetch(`${API}/api/v1/activities/${activity.id}/join`, {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          setMemberCount((c) => c + 1);
          setStatus("done");
        } else {
          setStatus("idle");
        }
      }}
      className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 dark:bg-emerald-500 dark:text-white"
    >
      Unirme
    </button>
  );
}
