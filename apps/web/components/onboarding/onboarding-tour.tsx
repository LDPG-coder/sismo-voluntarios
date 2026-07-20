"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
import { useSession } from "@/components/session-provider";
import { csrfHeaders } from "@/lib/auth/csrf-client";

const FLAG = "sismo_onboarding_done";
const TIP_W = 320;
const TIP_H = 180;
const PAD = 10;
const RING = 6;

type TourCtx = { start: () => void };
const TourContext = createContext<TourCtx>({ start: () => {} });
export function useTour() {
  return useContext(TourContext);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const { user } = useSession();
  const pathname = usePathname();

  const start = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  const finish = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FLAG, "1");
      window.dispatchEvent(new Event("sismo:onboarding-done"));
    }
    setOpen(false);
    setStep(0);
  }, []);

  // Arranque automatico para becarios (voluntarios) en su primera sesion,
  // unicamente en el feed (/voluntarios). En otras rutas no salta solo.
  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") return;
    if (typeof window === "undefined") return;
    // Forzar el tour con ?tour=1 (util para probarlo sin borrar el flag).
    if (new URLSearchParams(window.location.search).get("tour") === "1") {
      setOpen(true);
      return;
    }
    if (pathname !== "/voluntarios") return;
    if (localStorage.getItem(FLAG)) return;
    const t = window.setTimeout(() => setOpen(true), 800);
    return () => window.clearTimeout(t);
  }, [user, pathname]);

  // Al iniciar la induccion, asegura que el becario tenga su publicacion
  // privada de practica (aparece en "Mis actividades" como propia). Es
  // idempotente en el servidor: no crea duplicados si ya la tiene.
  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") return;
    if (!open) return;
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${API}/api/v1/activities/demo/ensure`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
    }).catch(() => {});
  }, [open, user]);

  return (
    <TourContext.Provider value={{ start }}>
      {children}
      {!open && user?.role !== "admin" && pathname === "/voluntarios" && (
        <button
          type="button"
          onClick={start}
          aria-label="Repetir el tour de inducción"
          title="Repetir el tour de inducción"
          className="fixed bottom-4 left-4 z-[90] flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg font-bold text-emerald-600 shadow-lg shadow-zinc-900/10 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-emerald-400 dark:hover:bg-zinc-800"
        >
          ?
        </button>
      )}
      {open && (
        <TourOverlay
          index={step}
          onNext={() => {
            if (step >= ONBOARDING_STEPS.length - 1) finish();
            else setStep((s) => s + 1);
          }}
          onPrev={() => setStep((s) => Math.max(0, s - 1))}
          onSkip={finish}
        />
      )}
    </TourContext.Provider>
  );
}

type OverlayProps = {
  index: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
};

function TourOverlay({ index, onNext, onPrev, onSkip }: OverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const stepData = ONBOARDING_STEPS[index];
  const total = ONBOARDING_STEPS.length;

  const recompute = useCallback(() => {
    const sel = stepData.selector;
    if (!sel) {
      setRect(null);
      return;
    }
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setRect(null);
      return;
    }
    setRect(r);
  }, [stepData.selector]);

  // Espera a que el elemento aparezca (el feed carga de forma asincrona) y
  // recalcula al hacer scroll/resize.
  useEffect(() => {
    setRect(null);
    const poll = window.setInterval(recompute, 150);
    const stop = window.setTimeout(() => clearInterval(poll), 3500);
    recompute();
    const onScroll = () => recompute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      clearInterval(poll);
      clearTimeout(stop);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [index, recompute]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip, onNext, onPrev]);

  if (typeof document === "undefined") return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let tipLeft: number;
  let tipTop: number;
  if (rect) {
    const cx = rect.left + rect.width / 2;
    tipLeft = clamp(cx - TIP_W / 2, 12, vw - TIP_W - 12);
    if (rect.bottom + PAD + TIP_H < vh) {
      tipTop = rect.bottom + PAD;
    } else if (rect.top - PAD - TIP_H > 0) {
      tipTop = rect.top - PAD - TIP_H;
    } else {
      tipTop = clamp(vh / 2 - TIP_H / 2, 12, vh - TIP_H - 12);
    }
  } else {
    tipLeft = clamp(vw / 2 - TIP_W / 2, 12, vw - TIP_W - 12);
    tipTop = clamp(vh / 2 - TIP_H / 2, 12, vh - TIP_H - 12);
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]" style={{ pointerEvents: "none" }}>
      {rect && (
        <div
          style={{
            position: "fixed",
            top: rect.top - RING,
            left: rect.left - RING,
            width: rect.width + RING * 2,
            height: rect.height + RING * 2,
            borderRadius: 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            border: "2px solid rgba(16,185,129,0.95)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}

      <div
        role="dialog"
        aria-label={stepData.title}
        style={{
          position: "fixed",
          left: tipLeft,
          top: tipTop,
          width: TIP_W,
          pointerEvents: "auto",
          zIndex: 20,
        }}
        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-[#18181b]"
      >
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          {stepData.title}
        </h3>
        <p className="mt-1.5 text-sm leading-snug text-zinc-600 dark:text-zinc-300">
          {stepData.body}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-400">
            {index + 1} / {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Saltar
            </button>
            <button
              type="button"
              onClick={onPrev}
              disabled={index === 0}
              className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 dark:bg-emerald-500"
            >
              {index >= total - 1 ? "Finalizar" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
