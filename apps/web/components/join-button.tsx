"use client";

import { useState } from "react";

type Activity = {
  id: string;
  max_participants: number | null;
  member_count: number;
};

type User = { id: string } | null;

export function JoinButton({ activity, user }: { activity: Activity; user: User }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "left">("idle");
  const [memberCount, setMemberCount] = useState(activity.member_count);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const spotsLeft =
    activity.max_participants != null ? activity.max_participants - memberCount : null;

  if (!user) {
    return (
      <p className="text-sm text-slate-500">
        Inicia sesion para unirte a esta actividad.
      </p>
    );
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-green-700">Inscrito</span>
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
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
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
        }
      }}
      disabled={status === "loading"}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
    >
      {status === "loading" ? "Uniendo..." : "Unirme"}
    </button>
  );
}
