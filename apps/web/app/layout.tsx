import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sismo Voluntarios",
  description: "Plataforma de voluntariado en tu zona",
};

export const dynamic = "force-dynamic";

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-[#f3f4f2] text-slate-900 antialiased dark:bg-[#0c0b0a] dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
