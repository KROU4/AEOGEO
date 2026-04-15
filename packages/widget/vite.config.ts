import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    watch: {
      chokidar: {
        usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
        interval: Number(process.env.CHOKIDAR_INTERVAL ?? 1000),
      },
    },
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "AeogeoWidget",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
    cssCodeSplit: false,
    minify: true,
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
