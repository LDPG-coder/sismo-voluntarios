"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UsuariosTableSkeleton } from "@/components/skeletons";
import { csrfHeaders } from "@/lib/auth/csrf-client";
import { displayPhoto } from "@/lib/photo";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  photo_url: string | null;
  cedula: string | null;
  role: string;
  status: string;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  volunteer: "Voluntario",
  sep: "SEP",
};

function roleLabel(r: string): string {
  return ROLE_LABELS[r] ?? r;
}

function Avatar({ url }: { url: string | null }) {
  return (
    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayPhoto(url) ?? ""} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-zinc-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </div>
      )}
    </div>
  );
}

export function AdminUsuariosClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [onlyNoPhoto, setOnlyNoPhoto] = useState(false);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [noPhotoTotal, setNoPhotoTotal] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [page, search, onlyNoPhoto]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [all, noPhoto] = await Promise.all([
        fetch(`${API}/api/v1/users?page_size=1`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/api/v1/users?page_size=1&has_photo=false`, { credentials: "include" }).then((r) => r.json()),
      ]);
      setTotalUsers(all.total);
      setNoPhotoTotal(noPhoto.total);
    } catch {
      // silencioso
    }
  };

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: "20",
      });
      if (search) params.set("search", search);
      if (onlyNoPhoto) params.set("has_photo", "false");

      const res = await fetch(`${API}/api/v1/users?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error loading users");
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    setProcessing(true);
    try {
      const res = await fetch(`${API}/api/v1/users/${editingUser.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders("PUT") },
        body: JSON.stringify({
          role: editingUser.role,
          status: editingUser.status,
          phone: editingUser.phone,
          name: editingUser.name,
        }),
      });
      if (!res.ok) throw new Error("Error updating user");
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditingUser(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <main className="mx-auto max-w-4xl px-4 pt-8 pb-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Gestionar Usuarios</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/voluntarios"
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              &larr; Volver
            </Link>
          </div>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar por email o nombre..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm">
            {totalUsers !== null && (
              <span className="text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalUsers}</span> usuarios
              </span>
            )}
            {noPhotoTotal !== null && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  noPhotoTotal === 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                }`}
              >
                {noPhotoTotal === 0
                  ? "Todos tienen foto"
                  : `${noPhotoTotal} sin foto`}
              </span>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={onlyNoPhoto}
              onChange={(e) => {
                setOnlyNoPhoto(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 accent-rose-600"
            />
            Solo sin foto
          </label>
        </div>

        {loading && <UsuariosTableSkeleton />}
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {!loading && users.length === 0 && (
          <p className="text-sm text-zinc-500">No se encontraron usuarios.</p>
        )}

        {users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
               <thead>
                 <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700">
                   <th className="pb-2 font-medium">Foto</th>
                   <th className="pb-2 font-medium">Email</th>
                   <th className="pb-2 font-medium">Nombre</th>
                   <th className="pb-2 font-medium">Cedula</th>
                   <th className="pb-2 font-medium">Teléfono</th>
                   <th className="pb-2 font-medium">Rol</th>
                   <th className="pb-2 font-medium">Estado</th>
                   <th className="pb-2 font-medium"></th>
                 </tr>
               </thead>
               <tbody>
                 {users.map((u) => (
                   <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800">
                     <td className="py-2">
                       <Avatar url={u.photo_url} />
                     </td>
                     <td className="py-2">{u.email}</td>
                     <td className="py-2">{u.name || "-"}</td>
                      <td className="py-2">{u.cedula || "-"}</td>
                      <td className="py-2">{u.phone || u.whatsapp || "-"}</td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.role === "admin"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                              : u.role === "sep"
                                ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                                : "bg-[#eaebed] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {roleLabel(u.role)}
                        </span>
                      </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : u.status === "pending"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="text-xs text-zinc-500 underline hover:text-zinc-700"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-zinc-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              Anterior
            </button>
            <span className="text-sm text-zinc-500">
              Pagina {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-zinc-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              Siguiente
            </button>
          </div>
        )}
      </main>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-[#18181b]">
            <h3 className="mb-4 text-lg font-bold">Editar Usuario</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Email</label>
                <p className="text-sm">{editingUser.email}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Nombre</label>
                <input
                  type="text"
                  value={editingUser.name || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Teléfono</label>
                <input
                  type="text"
                  value={editingUser.phone || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Rol</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="volunteer">Voluntario</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Estado</label>
                <select
                  value={editingUser.status}
                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="active">Activo</option>
                  <option value="pending">Pendiente</option>
                  <option value="suspended">Suspendido</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-emerald-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdate}
                disabled={processing}
                className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-white"
              >
                {processing ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
