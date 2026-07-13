import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow the SEP platform to embed Sismo Voluntarios inside an <iframe>
  // (SEP keeps its own header/sidebar; Sismo renders in EmbeddedShell).
  // Configure the allowed parent origins via SISMO_FRAME_ANCESTORS
  // (comma-separated, e.g. "https://sep.ejemplo.com"). Defaults to 'self'
  // (only same-origin framing) until configured.
  async headers() {
    const ancestors = (process.env.SISMO_FRAME_ANCESTORS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const frameAncestors = ancestors.length
      ? `${ancestors.join(" ")} self`
      : "self";
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
