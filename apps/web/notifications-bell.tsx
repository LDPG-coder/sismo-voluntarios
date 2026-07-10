"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  const [open, setOpen] = useState(false);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API}/api/v1/activities/notifications`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {
      // silent
    }
  };

  const markRead = async (id: string) => {
    try {
      await fetch(`${API}/api/v1/activities/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => markRead(n.id)));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-2 text-slate-500 transition hover:bg-[#eaebed] hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notificaciones</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-indigo-500 hover:text-indigo-600">
                  Marcar todas leidas
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-500">Sin notificaciones</p>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    markRead(n.id);
                    if (n.activity_id) {
                      window.location.href = `/voluntarios/${n.activity_id}`;
                    }
                  }}
                  className={`w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${
                    !n.read ? "bg-slate-50 dark:bg-slate-800/30" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{n.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {n.created_at ? new Date(n.created_at).toLocaleString("es-VE") : ""}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
