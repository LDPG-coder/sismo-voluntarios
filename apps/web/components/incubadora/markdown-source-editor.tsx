"use client";

import { useRef } from "react";
import { readFileAsDataURL, imageTooLarge, MAX_IMAGE_BYTES } from "@/lib/file";
import { cn } from "@/lib/utils";

type ToolbarButtonProps = {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
};

function ToolbarButton({ onClick, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm text-zinc-600 transition-colors hover:bg-[#eaebed] dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />;
}

export function MarkdownSourceEditor({
  value,
  onChange,
  placeholder = "Escribe en Markdown…",
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const withSelection = (fn: (sel: { start: number; end: number; text: string }) => { text: string; selStart: number; selEnd: number }) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = value;
    const { text: next, selStart, selEnd } = fn({ start, end, text });
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(selStart, selEnd);
    });
  };

  const wrap = (before: string, after: string = before) => {
    withSelection(({ start, end, text }) => {
      const selected = text.slice(start, end);
      const next = text.slice(0, start) + before + selected + after + text.slice(end);
      return {
        text: next,
        selStart: start + before.length,
        selEnd: start + before.length + selected.length,
      };
    });
  };

  const prefixLines = (prefix: string | ((i: number) => string)) => {
    withSelection(({ start, end, text }) => {
      const lineStart = text.lastIndexOf("\n", start - 1) + 1;
      let lineEnd = text.indexOf("\n", end);
      if (lineEnd === -1) lineEnd = text.length;
      const block = text.slice(lineStart, lineEnd);
      const lines = block.split("\n");
      const newBlock = lines
        .map((l, i) => (typeof prefix === "function" ? prefix(i) : prefix) + l)
        .join("\n");
      const next = text.slice(0, lineStart) + newBlock + text.slice(lineEnd);
      return {
        text: next,
        selStart: lineStart,
        selEnd: lineStart + newBlock.length,
      };
    });
  };

  const insertBlock = (snippet: string) => {
    withSelection(({ start, end, text }) => {
      const before = text.slice(0, start);
      const needsNlBefore = before.length > 0 && !before.endsWith("\n\n") && !before.endsWith("\n") ? "\n" : "";
      const insert = needsNlBefore + snippet;
      const next = before + insert + text.slice(end);
      const pos = start + insert.length;
      return { text: next, selStart: pos, selEnd: pos };
    });
  };

  const insertLink = () => {
    const url = window.prompt("URL del enlace");
    if (!url) return;
    withSelection(({ start, end, text }) => {
      const selected = text.slice(start, end) || "texto";
      const md = `[${selected}](${url})`;
      const next = text.slice(0, start) + md + text.slice(end);
      const pos = start + md.length;
      return { text: next, selStart: pos, selEnd: pos };
    });
  };

  const insertImage = async (file: File) => {
    if (imageTooLarge(file)) {
      alert(`La imagen supera el límite de ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      const md = `![${file.name}](${dataUrl})`;
      withSelection(({ start, end, text }) => {
        const next = text.slice(0, start) + md + text.slice(end);
        const pos = start + md.length;
        return { text: next, selStart: pos, selEnd: pos };
      });
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border-b border-zinc-200 bg-[#f7f8f9] p-1 dark:border-zinc-800 dark:bg-zinc-900">
        <ToolbarButton title="Negrita" onClick={() => wrap("**")}>
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton title="Cursiva" onClick={() => wrap("*")}>
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton title="Resaltar" onClick={() => wrap("==")}>
          <span className="rounded bg-yellow-200 px-1">A</span>
        </ToolbarButton>
        <ToolbarButton title="Código en línea" onClick={() => wrap("`")}>
          {"`c`"}
        </ToolbarButton>
        <Divider />
        <ToolbarButton title="Título" onClick={() => prefixLines("## ")}>
          H2
        </ToolbarButton>
        <ToolbarButton title="Subtítulo" onClick={() => prefixLines("### ")}>
          H3
        </ToolbarButton>
        <Divider />
        <ToolbarButton title="Lista" onClick={() => prefixLines("- ")}>
          •
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" onClick={() => prefixLines((i) => `${i + 1}. `)}>
          1.
        </ToolbarButton>
        <ToolbarButton title="Lista de tareas" onClick={() => prefixLines("- [ ] ")}>
          ☑
        </ToolbarButton>
        <ToolbarButton title="Cita" onClick={() => prefixLines("> ")}>
          ❝
        </ToolbarButton>
        <ToolbarButton title="Bloque de código" onClick={() => insertBlock("```\ncódigo\n```\n")}>
          {"</>"}
        </ToolbarButton>
        <ToolbarButton title="Separador" onClick={() => insertBlock("\n---\n")}>
          —
        </ToolbarButton>
        <Divider />
        <ToolbarButton title="Enlace" onClick={insertLink}>
          🔗
        </ToolbarButton>
        <ToolbarButton title="Imagen" onClick={() => fileRef.current?.click()}>
          🖼
        </ToolbarButton>
        <ToolbarButton title="Tabla" onClick={() => insertBlock("| Columna 1 | Columna 2 |\n| --- | --- |\n| Celda | Celda |\n")}>
          ▦
        </ToolbarButton>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck
        className="min-h-[220px] max-h-[520px] w-full resize-y overflow-y-auto rounded-b-md border-0 bg-white px-3 py-2 font-mono text-sm leading-relaxed text-zinc-900 focus:outline-none dark:bg-zinc-950 dark:text-zinc-100"
      />
      <p className="px-3 py-1.5 text-xs text-zinc-400 dark:text-zinc-500">
        Editas el Markdown directamente: <code>## Título</code>,{" "}
        <code>**negrita**</code>, <code>==resaltado==</code>,{" "}
        <code>- lista</code>. Selecciona texto y pulsa un botón para envolverlo.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void insertImage(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
