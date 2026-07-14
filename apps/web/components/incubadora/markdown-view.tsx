"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function MarkdownView({
  content,
  className,
}: {
  content?: string | null;
  className?: string;
}) {
  if (!content) return null;
  return (
    <div className={cn("text-sm leading-relaxed text-zinc-700 dark:text-zinc-300", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h1 className="mb-2 mt-4 text-xl font-bold" {...props} />,
          h2: ({ node, ...props }) => <h2 className="mb-2 mt-4 text-lg font-semibold" {...props} />,
          h3: ({ node, ...props }) => <h3 className="mb-1 mt-3 text-base font-semibold" {...props} />,
          p: ({ node, ...props }) => <p className="mb-2" {...props} />,
          ul: ({ node, ...props }) => <ul className="mb-2 list-disc pl-5" {...props} />,
          ol: ({ node, ...props }) => <ol className="mb-2 list-decimal pl-5" {...props} />,
          li: ({ node, ...props }) => <li className="mb-0.5" {...props} />,
          a: ({ node, ...props }) => (
            <a className="text-emerald-600 underline" target="_blank" rel="noreferrer" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-2 border-zinc-300 pl-3 italic text-zinc-500 dark:border-zinc-700" {...props} />
          ),
          code: ({ node, ...props }) => (
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.8em] dark:bg-zinc-800" {...props} />
          ),
          pre: ({ node, ...props }) => (
            <pre className="mb-2 overflow-x-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-800" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="mb-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border border-zinc-200 px-2 py-1 text-left font-semibold dark:border-zinc-700" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-zinc-200 px-2 py-1 align-top dark:border-zinc-700" {...props} />
          ),
          hr: ({ node, ...props }) => <hr className="my-3 border-zinc-200 dark:border-zinc-700" {...props} />,
          img: ({ node, ...props }) => <img className="my-2 max-w-full rounded-md" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
