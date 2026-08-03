import { cloudflare } from "@cloudflare/vite-plugin";
import fullstack from "@hiogawa/vite-plugin-fullstack";
import tailwind from "@tailwindcss/vite";
import jsx from "srv-jsx/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  environments: {
    client: {
      build: {
        outDir: "./dist/client",
        rolldownOptions: {
          input: { index: "./src/browser.ts" },
        },
      },
    },
    ssr: {
      build: {
        outDir: "./dist/ssr",
        emitAssets: true,
      },
    },
  },
  plugins: [
    jsx(),
    tailwind(),
    fullstack({ serverEnvironments: ["ssr"], serverHandler: false }),
    cloudflare({
      viteEnvironment: { name: "ssr" },
      configPath: "./wrangler.jsonc",
    }),
  ],
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
