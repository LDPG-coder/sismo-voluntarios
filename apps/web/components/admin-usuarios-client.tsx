"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav-bar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  status: string;
  created_at: string;
}

export function AdminUsuariosClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: "20",
      });
      if (search) params.set("search", search);

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
        headers: { "Content-Type": "application/json" },
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
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Gestionar Usuarios</h1>
          <Link
            href="/voluntarios"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            &larr; Volver
          </Link>
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
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        {loading && <p className="text-sm text-slate-500">Cargando...</p>}
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {!loading && users.length === 0 && (
          <p className="text-sm text-slate-500">No se encontraron usuarios.</p>
        )}

        {users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Nombre</th>
                  <th className="pb-2 font-medium">Telefono</th>
                  <th className="pb-2 font-medium">Rol</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{u.name || "-"}</td>
                    <td className="py-2">{u.phone || "-"}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.status === "active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
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
                        className="text-xs text-slate-500 underline hover:text-slate-700"
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
              className="rounded-md border border-slate-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-700"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-500">
              Pagina {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-slate-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-700"
            >
              Siguiente
            </button>
          </div>
        )}
      </main>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <h3 className="mb-4 text-lg font-bold">Editar Usuario</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
                <p className="text-sm">{editingUser.email}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Nombre</label>
                <input
                  type="text"
                  value={editingUser.name || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Telefono</label>
                <input
                  type="text"
                  value={editingUser.phone || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Rol</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="volunteer">Voluntario</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
                <select
                  value={editingUser.status}
                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
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
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdate}
                disabled={processing}
                className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
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
