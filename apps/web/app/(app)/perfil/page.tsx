import { requireSession } from "@/lib/auth/require-session";
import { fetchCurrentUser } from "@/lib/auth/me";
import { ProfilePhoto } from "@/components/profile-photo";

export default async function PerfilPage() {
  await requireSession();
  const user = await fetchCurrentUser();
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mb-6 text-xl font-bold">Mi perfil</h1>

        <div className="space-y-6">
          <ProfilePhoto initialPhotoUrl={user.photo_url} defaultPhotoUrl={user.google_photo_url} />

          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#18181b]">
            <p className="text-sm text-zinc-500">Nombre</p>
            <p className="font-medium">{user.name || "Sin nombre"}</p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#18181b]">
            <p className="text-sm text-zinc-500">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>

        </div>
      </main>
    </div>
  );
}
