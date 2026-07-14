"use client";

import { useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Markdown } from "tiptap-markdown";
import { readFileAsDataURL, imageTooLarge, MAX_IMAGE_BYTES } from "@/lib/file";
import { cn } from "@/lib/utils";

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
};

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors disabled:opacity-40",
        active
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
          : "text-zinc-600 hover:bg-[#eaebed] dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />;
}

function getMarkdown(editor: Editor): string {
  try {
    return editor.storage.markdown.getMarkdown();
  } catch {
    return editor.getText();
  }
}

export function ProposalEditor({
  value,
  onChange,
  placeholder = "Describe tu proyecto con el mayor detalle posible…",
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Highlight,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown,
    ],
    content: value ?? "",
    editorProps: {
      attributes: {
        class:
          "min-h-[220px] max-h-[520px] overflow-y-auto rounded-b-md border border-t-0 border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(getMarkdown(editor)),
  });

  const insertImage = async (file: File) => {
    if (!editor) return;
    if (imageTooLarge(file)) {
      alert(`La imagen supera el límite de ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      editor.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
    } catch {
      /* ignore */
    }
  };

  if (!editor) {
    return (
      <div className="min-h-[220px] rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
    );
  }

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border-b border-zinc-200 bg-[#f7f8f9] p-1 dark:border-zinc-800 dark:bg-zinc-900">
        <ToolbarButton title="Negrita" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton title="Cursiva" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton title="Subrayado" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton title="Resaltar" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <span className="rounded bg-yellow-200 px-1">A</span>
        </ToolbarButton>
        <Divider />
        <ToolbarButton title="Título" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </ToolbarButton>
        <ToolbarButton title="Subtítulo" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </ToolbarButton>
        <Divider />
        <ToolbarButton title="Lista" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1.
        </ToolbarButton>
        <ToolbarButton title="Lista de tareas" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          ☑
        </ToolbarButton>
        <ToolbarButton title="Cita" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          ❝
        </ToolbarButton>
        <ToolbarButton title="Código" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          {"</>"}
        </ToolbarButton>
        <ToolbarButton title="Separador" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          —
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          title="Enlace"
          active={editor.isActive("link")}
          onClick={() => {
            const url = window.prompt("URL del enlace");
            if (url) editor.chain().focus().setLink({ href: url }).run();
            else editor.chain().focus().unsetLink().run();
          }}
        >
          🔗
        </ToolbarButton>
        <ToolbarButton title="Imagen" onClick={() => fileRef.current?.click()}>
          🖼
        </ToolbarButton>
        <ToolbarButton
          title="Tabla"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          ▦
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
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
