"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      // Honor a ?theme=dark|light override (the SEP can append its current
      // theme so SISMO's chrome matches SEP's). Persist it so later
      // navigations keep the chosen theme.
      const fromUrl = new URLSearchParams(window.location.search).get("theme");
      if (fromUrl === "dark" || fromUrl === "light") {
        localStorage.setItem("theme", fromUrl);
      }
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
