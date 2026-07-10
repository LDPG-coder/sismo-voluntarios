import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sismo Voluntarios",
  description: "Plataforma de voluntariado en tu zona",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" translate="no" className="notranslate">
      <body className="min-h-screen bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
