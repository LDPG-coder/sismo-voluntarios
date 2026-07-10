"use client";

import { useState } from "react";

export function ReferralBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#18181b]">
      <p className="text-sm text-zinc-500">Tu codigo de referido</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="rounded bg-[#eaebed] px-3 py-1.5 font-mono text-lg font-bold tracking-wider dark:bg-zinc-800">
          {code}
        </code>
        <button
          onClick={handleCopy}
          className="rounded-md bg-[#eaebed] px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Comparte este codigo con personas que quieras invitar.
      </p>
    </div>
  );
}
