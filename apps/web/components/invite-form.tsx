"use client";

import { useState } from "react";
import { csrfHeaders } from "@/lib/auth/csrf-client";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");

    try {
      const res = await fetch(`${API}/api/v1/auth/invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setStatus("success");
        setMessage(`Invitacion enviada a ${email}. Codigo: ${data.referral_code}`);
        setEmail("");
      } else {
        const data = await res.json();
        setStatus("error");
        setMessage(data.error?.message || "Error al invitar");
      }
    } catch {
      setStatus("error");
      setMessage("Error de conexion");
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium">Invitar persona</p>
      <form onSubmit={handleInvite} className="mt-2 flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@ejemplo.com"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          Invitar
        </button>
      </form>
      {message && (
        <p
          className={`mt-2 text-xs ${
            status === "success" ? "text-green-600" : "text-rose-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
