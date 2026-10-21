import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its bundled font metrics from disk at runtime, so keep it out of the bundle.
  serverExternalPackages: ["pdfkit"],
  // The Thai fonts are read with fs at request time; make sure they ship with the PDF route.
  outputFileTracingIncludes: {
    "/memos/[id]/pdf": ["./src/lib/memo/fonts/**", "./src/lib/memo/assets/**"],
    "/memos/[id]/docx": ["./src/lib/memo/assets/**"],
  },
  // The classroom import accepts files up to 1 MB; the default 1 MB body leaves no room for the
  // multipart overhead. The action itself still refuses anything over 1 MB.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

export default nextConfig;
