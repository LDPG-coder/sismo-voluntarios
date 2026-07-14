"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProposalAiEditor } from "@/components/incubadora/proposal-ai-editor";
import { BudgetBuilder, type BudgetRow } from "@/components/incubadora/budget-builder";
import {
  readFileAsDataURL,
  imageTooLarge,
  docTooLarge,
  MAX_IMAGE_BYTES,
  MAX_DOC_BYTES,
} from "@/lib/file";
import { csrfHeaders } from "@/lib/auth/csrf-client";

type Attachment = {
  kind: "image" | "document";
  filename: string;
  content_type: string;
  data: string;
  size: number;
};

type CronoRow = { label: string; date: string };

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
      {children}
    </div>
  );
}

function StringList({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const update = (i: number, v: string) => onChange(values.map((x, idx) => (idx === i ? v : x)));
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input value={v} placeholder={placeholder} onChange={(e) => update(i, e.target.value)} />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, idx) => idx !== i))}
            className="px-2 text-zinc-400 hover:text-rose-600"
            aria-label="Eliminar"
          >
            ✕
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...values, ""])}>
        + Añadir
      </Button>
    </div>
  );
}

export type ProposalInitial = {
  title: string;
  category: string;
  description: string | null;
  problematica: string | null;
  impacto_esperado: string | null;
  plan_ejecucion: string | null;
  objetivos: string[];
  recursos_necesarios: string[];
  cronograma: { label: string; date: string }[];
  budget: BudgetRow[];
  is_anonymous: boolean;
};

export function CrearPropuestaClient({
  projectId,
  initial,
}: {
  projectId?: string;
  initial?: ProposalInitial;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [problematica, setProblematica] = useState(initial?.problematica ?? "");
  const [impacto, setImpacto] = useState(initial?.impacto_esperado ?? "");
  const [plan, setPlan] = useState(initial?.plan_ejecucion ?? "");
  const [objetivos, setObjetivos] = useState<string[]>(initial?.objetivos?.length ? initial.objetivos : [""]);
  const [recursos, setRecursos] = useState<string[]>(initial?.recursos_necesarios?.length ? initial.recursos_necesarios : [""]);
  const [cronograma, setCronograma] = useState<CronoRow[]>(
    initial?.cronograma?.length ? initial.cronograma : [{ label: "", date: "" }],
  );
  const [budget, setBudget] = useState<BudgetRow[]>(initial?.budget ?? []);
  const [images, setImages] = useState<Attachment[]>([]);
  const [documents, setDocuments] = useState<Attachment[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(initial?.is_anonymous ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (
    files: FileList | null,
    kind: "image" | "document",
    sink: (a: Attachment[]) => void,
    current: Attachment[],
  ) => {
    if (!files) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      const tooLarge = kind === "image" ? imageTooLarge(file) : docTooLarge(file);
      const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_DOC_BYTES;
      if (tooLarge) {
        setError(`"${file.name}" supera el limite de ${Math.round(limit / 1024 / 1024)} MB`);
        continue;
      }
      const data = await readFileAsDataURL(file);
      next.push({
        kind,
        filename: file.name,
        content_type: file.type || (kind === "image" ? "image/png" : "application/octet-stream"),
        data,
        size: file.size,
      });
    }
    sink([...current, ...next]);
  };

  const submit = async () => {
    setError(null);
    if (!title.trim() || !category.trim()) {
      setError("El titulo y la categoria son obligatorios.");
      return;
    }
    setSubmitting(true);
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const body = {
      title: title.trim(),
      category: category.trim(),
      description: description || undefined,
      problematica: problematica || undefined,
      impacto_esperado: impacto || undefined,
      plan_ejecucion: plan || undefined,
      objetivos: objetivos.map((o) => o.trim()).filter(Boolean),
      recursos_necesarios: recursos.map((r) => r.trim()).filter(Boolean),
      cronograma: cronograma
        .filter((c) => c.label.trim() && c.date)
        .map((c) => ({ label: c.label.trim(), date: c.date })),
      budget: budget
        .filter((b) => b.concept.trim())
        .map((b) => ({ concept: b.concept.trim(), quantity: b.quantity, unit_cost: b.unit_cost })),
      is_anonymous: isAnonymous,
      images: images.map((i) => ({
        kind: i.kind,
        filename: i.filename,
        content_type: i.content_type,
        data: i.data,
        size: i.size,
      })),
      documents: documents.map((d) => ({
        kind: d.kind,
        filename: d.filename,
        content_type: d.content_type,
        data: d.data,
        size: d.size,
      })),
    };
    try {
      const url = projectId
        ? `${API}/api/v1/incubator/projects/${projectId}`
        : `${API}/api/v1/incubator/projects`;
      const res = await fetch(url, {
        method: projectId ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders(projectId ? "PUT" : "POST") },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || (projectId ? "No se pudo actualizar la propuesta." : "No se pudo crear la propuesta."));
        setSubmitting(false);
        return;
      }
      router.push(`/incubadora/${projectId ?? data.id}`);
    } catch {
      setError(projectId ? "Error de red al actualizar la propuesta." : "Error de red al crear la propuesta.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{projectId ? "Editar propuesta" : "Proponer un proyecto"}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {projectId
              ? "Actualiza tu propuesta mientras esta en evaluacion."
              : "Construye una propuesta completa para que la comunidad la evalue y mejore."}
          </p>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Datos basicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Titulo">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre del proyecto" />
              </Field>
              <Field label="Categoria" hint="Ej. Educacion, Medio ambiente, Salud">
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoria" />
              </Field>
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                />
                Publicar de forma anonima
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Descripcion y proposito</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Descripcion completa">
                <ProposalAiEditor value={description} onChange={setDescription} />
              </Field>
              <Field label="Problematica que busca resolver">
                <Textarea
                  value={problematica}
                  onChange={(e) => setProblematica(e.target.value)}
                  className="min-h-[80px]"
                />
              </Field>
              <Field label="Impacto esperado">
                <Textarea
                  value={impacto}
                  onChange={(e) => setImpacto(e.target.value)}
                  className="min-h-[80px]"
                />
              </Field>
              <Field label="Objetivos">
                <StringList values={objetivos} onChange={setObjetivos} placeholder="Objetivo" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Planificacion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Plan de ejecucion">
                <ProposalAiEditor
                  value={plan}
                  onChange={setPlan}
                  placeholder="Explica como ejecutaras el proyecto."
                />
              </Field>
              <Field label="Cronograma">
                <div className="space-y-2">
                  {cronograma.map((c, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={c.label}
                        placeholder="Hito"
                        onChange={(e) =>
                          setCronograma((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)),
                          )
                        }
                      />
                      <Input
                        type="date"
                        value={c.date}
                        className="w-44"
                        onChange={(e) =>
                          setCronograma((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, date: e.target.value } : x)),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setCronograma((prev) => prev.filter((_, idx) => idx !== i))}
                        className="px-2 text-zinc-400 hover:text-rose-600"
                        aria-label="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCronograma((prev) => [...prev, { label: "", date: "" }])}
                  >
                    + Añadir hito
                  </Button>
                </div>
              </Field>
              <Field label="Recursos necesarios">
                <StringList values={recursos} onChange={setRecursos} placeholder="Recurso" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Presupuesto</CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetBuilder value={budget} onChange={setBudget} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Imagenes y documentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Imagenes" hint="Hasta 4 MB por archivo">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => void handleFiles(e.target.files, "image", setImages, images)}
                  className="block w-full text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="relative"
                      title="Quitar"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.data} alt="" className="h-16 w-16 rounded object-cover" />
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Documentos" hint="Hasta 8 MB por archivo">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  multiple
                  onChange={(e) => void handleFiles(e.target.files, "document", setDocuments, documents)}
                  className="block w-full text-sm"
                />
                <ul className="space-y-1 text-sm">
                  {documents.map((d, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">{d.filename}</span>
                      <button
                        type="button"
                        onClick={() => setDocuments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-zinc-400 hover:text-rose-600"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </Field>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push("/incubadora")}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Publicando…" : "Publicar propuesta"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
