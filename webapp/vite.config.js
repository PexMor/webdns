import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
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
      workbox: {
        navigateFallbackDenylist: [/^\/ws/],
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
