import type { NextConfig } from "next";

// When SISMO is served as one more page under the SEP domain on a sub-path
// (e.g. https://sep.org/voluntarios-becarios), set NEXT_PUBLIC_BASE_PATH to that
// path at BUILD time so every route, asset and Link is prefixed correctly.
// Empty (default) serves SISMO at the domain root (standalone hosting).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

const nextConfig: NextConfig = {
  output: "standalone",
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
