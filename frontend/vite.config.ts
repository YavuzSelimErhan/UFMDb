import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "url";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // NOT: base'i kaldırdık — bu, GitHub Pages'te proje sayfası olarak
  // (.../UFMDb/ altında) yayınlandığımız için gerekliydi. Cloudflare Workers'ta
  // domain kökünde ("/") yayınlanıyoruz, base olmadan varsayılan "/" kullanılır.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://localhost:7001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
