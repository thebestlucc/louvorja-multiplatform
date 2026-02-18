import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM == "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }
          if (id.includes("@tauri-apps")) {
            return "vendor-tauri";
          }
          if (id.includes("@tanstack")) {
            return "vendor-tanstack";
          }
          if (
            id.includes("@radix-ui")
            || id.includes("@dnd-kit")
            || id.includes("cmdk")
            || id.includes("lucide-react")
          ) {
            return "vendor-ui";
          }
          if (id.includes("i18next") || id.includes("react-i18next")) {
            return "vendor-i18n";
          }
          if (
            id.includes("react")
            || id.includes("scheduler")
            || id.includes("use-sync-external-store")
          ) {
            return "vendor-react";
          }
          return "vendor-misc";
        },
      },
    },
  },
});
