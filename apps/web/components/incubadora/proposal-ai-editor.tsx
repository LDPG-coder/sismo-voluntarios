"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Markdown } from "tiptap-markdown";
import { MarkdownSourceEditor } from "@/components/incubadora/markdown-source-editor";
import { cn } from "@/lib/utils";

type Mode = 0 | 1 | 2;

const STATUS_STEPS = [
  "Leyendo tu borrador…",
  "Clarificando ideas…",
  "Ordenando prioridades…",
  "Dando formato…",
  "Puliendo detalles…",
];

function MarkdownPreview({ markdown }: { markdown: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Highlight,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown,
    ],
    content: markdown ?? "",
    editorProps: {
      attributes: {
        class:
          "min-h-[220px] max-h-[520px] overflow-y-auto rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && markdown !== undefined) {
      editor.commands.setContent(markdown ?? "", false);
    }
  }, [markdown, editor]);

  if (!editor) {
    return <div className="min-h-[220px] rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />;
  }
  return <EditorContent editor={editor} />;
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors",
        active
          ? "bg-emerald-600 text-white"
          : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
      )}
    >
      {label}
    </button>
  );
}

export function ProposalAiEditor({
  value,
  onChange,
  placeholder = "Escribe libremente todo lo que quieras contar sobre tu proyecto. No te preocupes por el orden ni el formato…",
  specsPlaceholder = "Opcional: ¿cómo quieres el resultado? Ej. tono formal, con secciones, resaltar los objetivos…",
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  specsPlaceholder?: string;
}) {
  const [mode, setMode] = useState<Mode>(() => (value && value.trim().length > 0 ? 1 : 0));
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  const [draft, setDraft] = useState("");
  const [specs, setSpecs] = useState("");
  const [generated, setGenerated] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusStep, setStatusStep] = useState(0);
  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasResult = generated.length > 0 || value.length > 0;

  useEffect(() => {
    if (loading) {
      setStatusStep(0);
      statusTimer.current = setInterval(() => {
        setStatusStep((s) => (s + 1) % STATUS_STEPS.length);
      }, 1400);
    } else if (statusTimer.current) {
      clearInterval(statusTimer.current);
      statusTimer.current = null;
    }
    return () => {
      if (statusTimer.current) clearInterval(statusTimer.current);
    };
  }, [loading]);

  const goTo = (next: Mode) => {
    setSlideDir(next > mode ? "right" : "left");
    setMode(next);
  };

  const generate = async () => {
    if (draft.trim().length < 10) {
      setError("Escribe al menos unas líneas antes de generar.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/format-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: draft, specs: specs || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "No se pudo generar el texto. Intenta de nuevo.");
        return;
      }
      const md = data.markdown ?? "";
      setGenerated(md);
      onChange(md);
      goTo(1);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-[#f7f8f9] p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
        <TabButton label="Escribir con IA" active={mode === 0} onClick={() => goTo(0)} />
        <TabButton label="Resultado" active={mode === 1} onClick={() => goTo(1)} />
        <TabButton label="Editar a mano" active={mode === 2} onClick={() => goTo(2)} />
      </div>

      <div className="overflow-hidden p-3">
        <div
          key={mode}
          className={slideDir === "right" ? "animate-slide-in-right" : "animate-slide-in-left"}
        >
          {mode === 0 && (
            <div className="space-y-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                className="min-h-[220px] w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <textarea
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                placeholder={specsPlaceholder}
                className="min-h-[60px] w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  {loading ? "Generando…" : hasResult ? "Regenerar descripción" : "Generar descripción"}
                </button>
                {loading && (
                  <span
                    key={statusStep}
                    className="animate-ai-status flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400"
                  >
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    {STATUS_STEPS[statusStep]}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Usar la IA es opcional: escribe con tus palabras y ella
                organizará el texto, o pasa directamente a
                <span className="font-semibold"> Editar a mano</span> si
                prefieres redactarlo tú. Puedes moverte entre las secciones
                cuando quieras.
              </p>
            </div>
          )}

          {mode === 1 && (
            <div className="space-y-3">
              {value.trim().length > 0 ? (
                <MarkdownPreview markdown={value} />
              ) : (
                <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed border-zinc-200 px-4 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                  Aún no hay contenido. Genera un texto con IA o escríbelo en
                  «Editar a mano» para verlo aquí.
                </div>
              )}
            </div>
          )}

          {mode === 2 && (
            <MarkdownSourceEditor value={value} onChange={onChange} placeholder={placeholder} />
          )}
        </div>
      </div>
    </div>
  );
}
