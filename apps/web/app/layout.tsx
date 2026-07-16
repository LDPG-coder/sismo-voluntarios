import type { Metadata } from "next";
import "./globals.css";
import { ThemeSync } from "@/components/theme-sync";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Sismo Voluntarios",
  description: "Plataforma de voluntariado en tu zona",
};

export const dynamic = "force-dynamic";

  const themeScript = `(function(){try{var p=new URLSearchParams(window.location.search).get('theme');if(p==='dark'||p==='light'){try{localStorage.setItem('theme',p);}catch(e){}}var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

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
      <body className="flex min-h-screen flex-col bg-[#f4f5f7] text-zinc-900 antialiased dark:bg-[#0c0b0a] dark:text-zinc-100">
        <ThemeSync />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
