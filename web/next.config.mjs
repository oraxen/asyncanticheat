import nextra from "nextra";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false,
  },
  contentDirBasePath: "/docs",
});

export default withNextra({
  reactStrictMode: true,
  experimental: {
    // Disable optimizeCss which processes all CSS with PostCSS
    optimizeCss: false,
  },
  images: {
    // Disable image optimization for static docs screenshots
    // They're already optimized as high-quality WebP
    unoptimized: true,
  },
});
