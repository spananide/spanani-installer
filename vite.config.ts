import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const isMock = process.env.VITE_MOCK === "1";

const rootDir = import.meta.dirname ?? path.resolve(".");

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  resolve: isMock
    ? {
        alias: {
          "@tauri-apps/api/core": path.resolve(rootDir, "src/mock/core.ts"),
          "@tauri-apps/api/event": path.resolve(rootDir, "src/mock/event.ts"),
          "@tauri-apps/api/app": path.resolve(rootDir, "src/mock/app.ts"),
          "@tauri-apps/plugin-dialog": path.resolve(rootDir, "src/mock/dialog.ts"),
          "@tauri-apps/plugin-opener": path.resolve(rootDir, "src/mock/opener.ts"),
          "@tauri-apps/plugin-store": path.resolve(rootDir, "src/mock/store.ts"),
          "@tauri-apps/plugin-process": path.resolve(rootDir, "src/mock/process.ts"),
        },
      }
    : undefined,

  build: {
    target: "es2018",
  },

  clearScreen: false,
  server: {
    port: 1420,
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
}));
