import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      // nelle prove l'area admin è configurata con un AUD finto; i token li firma la prova
      miniflare: { bindings: { ACCESS_AUD: "aud-di-prova" } },
    }),
  ],
});
