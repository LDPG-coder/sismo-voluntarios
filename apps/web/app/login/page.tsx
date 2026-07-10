import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Sismo Voluntarios
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Iniciar sesion</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Accede para unirte a actividades de voluntariado en tu zona.
        </p>
      </header>

      <ErrorBanner searchParams={searchParams} />

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#18181b]">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          Inicia sesion con tu cuenta de Google para participar.
        </p>
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/auth/login`}
          className="inline-flex w-full items-center justify-center rounded-md bg-[#4285F4] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3367D6] focus:outline-none focus:ring-2 focus:ring-[#4285F4] focus:ring-offset-2"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continuar con Google
        </a>
      </div>

      <div className="mt-6">
        <p className="text-center text-xs text-slate-500">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="underline hover:text-slate-700">
            Registrate con un codigo de invitacion
          </Link>
        </p>
      </div>
    </main>
  );
}

async function ErrorBanner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  if (params.error === "suspended") {
    return (
      <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
        Su cuenta esta suspendida. Contacta al administrador.
      </p>
    );
  }
  if (params.error === "not_invited") {
    return (
      <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
        Tu cuenta no tiene invitacion. Pide a un voluntario que te invite.
      </p>
    );
  }
  if (params.error === "oauth_state") {
    return (
      <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
        La sesion de OAuth expiro. Intenta de nuevo.
      </p>
    );
  }
  if (params.error === "oauth_exchange") {
    return (
      <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
        Error al intercambiar el codigo de OAuth. Intenta de nuevo.
      </p>
    );
  }
  return null;
}
