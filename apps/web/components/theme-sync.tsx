"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      const root = document.documentElement;
      if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    } catch {}
  }, [pathname]);

  return null;
}
