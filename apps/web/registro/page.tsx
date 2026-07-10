"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegistroPage() {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const handleValidateCode = async () => {
    if (!code.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch(`${API}/api/v1/auth/referral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.ok) {
        setStatus("success");
        setMessage("Codigo valido. Ahora inicia sesion con Google y tu cuenta sera activada.");
      } else {
        setStatus("error");
        setMessage("Codigo invalido. Pide un codigo valido a un voluntario.");
      }
    } catch {
      setStatus("error");
      setMessage("Error al validar el codigo.");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Sismo Voluntarios
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Registro</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Necesitas un codigo de invitacion para unirte.
        </p>
      </header>

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="mb-1 block text-sm font-medium">Codigo de invitacion</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej: AVAA-7J2K"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm uppercase focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              onClick={handleValidateCode}
              disabled={status === "loading"}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-white"
            >
              Validar
            </button>
          </div>
        </div>

        {message && (
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              status === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            }`}
          >
            {message}
          </p>
        )}

        {status === "success" && (
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/auth/login`}
            className="inline-flex w-full items-center justify-center rounded-md bg-[#4285F4] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3367D6]"
          >
            Continuar con Google
          </a>
        )}
      </div>

      <div className="mt-6 text-center text-xs text-slate-500">
        <Link href="/login" className="underline">
          &larr; Volver al login
        </Link>
      </div>
    </main>
  );
}
