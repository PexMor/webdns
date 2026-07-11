import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        // config.json and the identity-proxy probe path must never be
        // precached: they're handled by explicit network-first/network-only
        // routes in src/sw.ts so an expired proxy session stays observable.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
      },
      manifest: {
        name: "DNS Lookup",
        short_name: "DNS Lookup",
        description: "Query DNS records over a WebSocket-backed resolver.",
        start_url: "/",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#1e293b",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/ws": {
        target: "ws://127.0.0.1:8080",
        ws: true,
      },
      "/version": {
        target: "http://127.0.0.1:8080",
      },
    },
  },
});
