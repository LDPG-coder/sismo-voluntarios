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
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500">Tu codigo de referido</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="rounded bg-slate-100 px-3 py-1.5 font-mono text-lg font-bold tracking-wider dark:bg-slate-800">
          {code}
        </code>
        <button
          onClick={handleCopy}
          className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Comparte este codigo con personas que quieras invitar.
      </p>
    </div>
  );
}
