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
import { ProposalEditor } from "@/components/incubadora/proposal-editor";
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
          "prose prose-sm max-w-none min-h-[220px] max-h-[520px] overflow-y-auto rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:prose-invert dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 focus:outline-none",
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
  done,
  disabled,
  onClick,
  index,
  label,
}: {
  active: boolean;
  done: boolean;
  disabled?: boolean;
  onClick: () => void;
  index: number;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-emerald-600 text-white"
          : done
            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
          active ? "bg-white/25" : "bg-zinc-200 dark:bg-zinc-700",
        )}
      >
        {index}
      </span>
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
        <TabButton index={1} label="Escribir" active={mode === 0} done={hasResult} onClick={() => goTo(0)} />
        <span className="text-zinc-300 dark:text-zinc-600">›</span>
        <TabButton
          index={2}
          label="Resultado"
          active={mode === 1}
          done={hasResult}
          disabled={!hasResult}
          onClick={() => hasResult && goTo(1)}
        />
        <span className="text-zinc-300 dark:text-zinc-600">›</span>
        <TabButton
          index={3}
          label="Editar"
          active={mode === 2}
          done={false}
          disabled={!hasResult}
          onClick={() => hasResult && goTo(2)}
        />
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
                Escribe con tus palabras; la IA organizará el texto y le dará
                formato. Luego podrás revisarlo y editarlo a mano.
              </p>
            </div>
          )}

          {mode === 1 && (
            <div className="space-y-3">
              <MarkdownPreview markdown={value} />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => goTo(0)}
                  className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  ‹ Volver a escribir
                </button>
                <button
                  type="button"
                  onClick={() => goTo(2)}
                  className="rounded-md border border-emerald-600 px-3 py-1.5 text-xs text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                >
                  Editar a mano ›
                </button>
              </div>
            </div>
          )}

          {mode === 2 && (
            <div className="space-y-3">
              <ProposalEditor value={value} onChange={onChange} placeholder={placeholder} />
              <button
                type="button"
                onClick={() => goTo(1)}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                ‹ Ver resultado
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
