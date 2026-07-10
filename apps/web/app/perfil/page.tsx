"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav-bar";
import { ReferralBox } from "@/components/referral-box";
import { InviteForm } from "@/components/invite-form";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  referral_code: string;
};

type AiSuggestion = {
  title: string;
  zone: string;
  raw_address: string;
  date_time: string | null;
  max_participants: number | null;
  requirements: string[];
};

const INPUT_cls =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800";

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [aiDesc, setAiDesc] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    fetch(`${API}/api/v1/auth/me`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("not authenticated");
        return r.json();
      })
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [API, router]);

  const handleAiSuggest = async () => {
    if (aiDesc.length < 10) {
      setAiError("Escribe al menos 10 caracteres");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/ai/suggest`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDesc }),
      });
      const limit = res.headers.get("X-RateLimit-Remaining");
      if (limit) setRemaining(parseInt(limit));
      if (!res.ok) {
        const data = await res.json();
        setAiError(data.error?.message || "Error al sugerir");
        return;
      }
      const data = await res.json();
      setAiSuggestion(data);
    } catch {
      setAiError("Error de conexion");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-slate-500">Cargando...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mb-6 text-xl font-bold">Mi perfil</h1>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Nombre</p>
            <p className="font-medium">{user.name || "Sin nombre"}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>

          <ReferralBox code={user.referral_code} />

          <InviteForm />

          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950">
            <h2 className="mb-2 text-sm font-bold text-indigo-900 dark:text-indigo-200">
              Sugerencia IA
            </h2>
            <p className="mb-3 text-xs text-indigo-700 dark:text-indigo-300">
              Describe tu actividad y la IA sugiere titulo, zona, direccion, requisitos y mas.
            </p>
            <textarea
              rows={3}
              value={aiDesc}
              onChange={(e) => setAiDesc(e.target.value)}
              placeholder="Ej: Limpieza del parque Los Caobos, necesitamos voluntarios para recoger basura y plantar arboles..."
              className={INPUT_cls}
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={handleAiSuggest}
                disabled={aiLoading || aiDesc.length < 10}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {aiLoading ? "Sugerizando..." : "Sugerir con IA"}
              </button>
              {remaining !== null && (
                <span className="text-xs text-indigo-500">{remaining} usos restantes esta hora</span>
              )}
            </div>

            {aiError && (
              <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{aiError}</p>
            )}

            {aiSuggestion && (
              <div className="mt-4 space-y-2 rounded-xl bg-white p-4 dark:bg-slate-900">
                <h3 className="text-xs font-bold text-slate-500">Sugerencia generada</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-400">Titulo</span>
                    <p className="font-medium">{aiSuggestion.title}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Zona</span>
                    <p className="font-medium">{aiSuggestion.zone}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-400">Direccion</span>
                    <p className="font-medium">{aiSuggestion.raw_address}</p>
                  </div>
                  {aiSuggestion.date_time && (
                    <div>
                      <span className="text-xs text-slate-400">Fecha sugerida</span>
                      <p className="font-medium">{new Date(aiSuggestion.date_time).toLocaleString("es-VE")}</p>
                    </div>
                  )}
                  {aiSuggestion.max_participants && (
                    <div>
                      <span className="text-xs text-slate-400">Participantes</span>
                      <p className="font-medium">{aiSuggestion.max_participants}</p>
                    </div>
                  )}
                  {aiSuggestion.requirements.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-xs text-slate-400">Requisitos</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {aiSuggestion.requirements.map((r, i) => (
                          <span key={i} className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <a
                  href={`/voluntarios/crear?prefill=1`}
                  className="mt-2 block text-center text-xs font-medium text-indigo-600 hover:underline"
                >
                  Usar esta sugerencia para crear actividad &rarr;
                </a>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
