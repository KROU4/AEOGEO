import fs from "fs";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

const widgetBundlePath = path.resolve(__dirname, "../widget/dist/widget.js");
const widgetOutputPath = path.resolve(__dirname, "./dist/widget.js");

function widgetBundlePlugin(): Plugin {
  return {
    name: "widget-bundle",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/widget.js")) {
          next();
          return;
        }

        if (!fs.existsSync(widgetBundlePath)) {
          res.statusCode = 503;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Widget bundle not found. Run `bun run build:widget` first.");
          return;
        }

        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.end(fs.readFileSync(widgetBundlePath, "utf8"));
      });
    },
    writeBundle() {
      if (!fs.existsSync(widgetBundlePath)) {
        throw new Error(
          `Missing widget bundle at ${widgetBundlePath}. Run \`bun run build:widget\` before building the web app.`,
        );
      }

      fs.mkdirSync(path.dirname(widgetOutputPath), { recursive: true });
      fs.copyFileSync(widgetBundlePath, widgetOutputPath);
    },
  };
}

export default defineConfig({
  plugins: [
    TanStackRouterVite({ quoteStyle: "double" }),
    react(),
    tailwindcss(),
    widgetBundlePlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "node",
  },
});
