import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "SheGuard",
        short_name: "SheGuard",
        theme_color: "#1e1b4b",
        background_color: "#ffffff",
        display: "standalone",
        icons: [],
      },
    }),
  ],
  server: { port: 5173 },
});
