import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  build: {
    // Speed up CI/Docker (Railway): tsc is skipped in `bun run build`; avoid slow sourcemaps there.
    sourcemap: process.env.SOURCEMAP === "true",
    reportCompressedSize: false,
  },
  plugins: [
    TanStackRouterVite({ quoteStyle: "double" }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    /** Listen on all interfaces (Docker) */
    host: true,
    /** Bind-mounts on Docker Desktop often miss fs events without polling */
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
      interval: Number(process.env.CHOKIDAR_INTERVAL ?? 1000),
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**"],
  },
});
