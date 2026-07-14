"use client";

import { useState, useEffect, useRef } from "react";
import { csrfHeaders } from "@/lib/auth/csrf-client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PAGE_SIZE = 20;

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  activity_id: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  offsetRef.current = offset;

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnread = async () => {
    try {
      const res = await fetch(`${API}/api/v1/activities/notifications/summary`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUnread(data.unread ?? 0);
      }
    } catch {
      // silent
    }
  };

  const loadNotifications = async (reset = true) => {
    try {
      const off = reset ? 0 : offsetRef.current;
      const res = await fetch(
        `${API}/api/v1/activities/notifications?limit=${PAGE_SIZE}&offset=${off}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data: Notification[] = await res.json();
        setNotifications((prev) => (reset ? data : [...prev, ...data]));
        const next = off + data.length;
        setOffset(next);
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch {
      // silent
    }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) loadNotifications(true);
  };

  const markRead = async (id: string) => {
    try {
      await fetch(`${API}/api/v1/activities/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
        headers: csrfHeaders("POST"),
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    const pending = notifications.filter((n) => !n.read);
    await Promise.all(pending.map((n) => markReadSilently(n.id)));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const markReadSilently = async (id: string) => {
    try {
      await fetch(`${API}/api/v1/activities/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
        headers: csrfHeaders("POST"),
      });
    } catch {
      // silent
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    await loadNotifications(false);
    setLoadingMore(false);
  };

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className="relative rounded-md bg-[#e9eaec] p-2 text-zinc-600 transition hover:bg-[#f1f2f4] hover:text-zinc-700 dark:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-2 top-14 z-50 flex max-h-[70vh] w-auto flex-col rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-[#18181b] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-80 sm:w-80">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notificaciones</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-indigo-500 hover:text-indigo-600">
                  Marcar todas leidas
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-zinc-500">Sin notificaciones</p>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={async () => {
                    if (!n.read) await markRead(n.id);
                    if (n.activity_id) {
                      window.location.href = `/voluntarios/${n.activity_id}`;
                    }
                  }}
                  className={`w-full border-b border-zinc-100 px-4 py-3 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${
                    !n.read ? "bg-zinc-50 dark:bg-zinc-800/30" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{n.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{n.message}</p>
                  <p className="mt-1 text-[10px] text-zinc-400">
                    {n.created_at ? new Date(n.created_at).toLocaleString("es-VE") : ""}
                  </p>
                </button>
              ))}
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full px-4 py-3 text-center text-xs font-medium text-indigo-500 hover:text-indigo-600 disabled:opacity-50"
                >
                  {loadingMore ? "Cargando..." : "Cargar mas"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
