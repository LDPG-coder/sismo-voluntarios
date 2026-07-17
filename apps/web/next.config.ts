import type { NextConfig } from "next";

// When SISMO is served as one more page under the SEP domain on a sub-path
// (e.g. https://sep.org/voluntarios-becarios), set NEXT_PUBLIC_BASE_PATH to that
// path at BUILD time so every route, asset and Link is prefixed correctly.
// Empty (default) serves SISMO at the domain root (standalone hosting).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

const nextConfig: NextConfig = {
  output: "standalone",
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // En modo mismo-origen (NEXT_PUBLIC_API_URL vacio/relativo, usado en dev y
  // tests E2E), proxiar /api al API interno para evitar CORS y problemas de
  // cookies cross-origin. Inerte en produccion, donde el web usa una URL
  // absoluta del API y nunca consulta /api en su propio origen.
  ...(process.env.NEXT_PUBLIC_API_URL
    ? {}
    : {
        async rewrites() {
          const target =
            process.env.INTERNAL_API_URL || "http://sismo-dev-api-1:8055";
          return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
        },
      }),
};

export default nextConfig;
