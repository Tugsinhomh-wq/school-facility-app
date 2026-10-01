import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its bundled font metrics from disk at runtime, so keep it out of the bundle.
  serverExternalPackages: ["pdfkit"],
  // The Thai fonts are read with fs at request time; make sure they ship with the PDF route.
  outputFileTracingIncludes: {
    "/memos/[id]/pdf": ["./src/lib/memo/fonts/**", "./src/lib/memo/assets/**"],
    "/memos/[id]/docx": ["./src/lib/memo/assets/**"],
  },
};

export default nextConfig;
