import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Bind IPv4 + IPv6. On Windows, default [::1]-only breaks http://localhost → 127.0.0.1.
    host: true,
    port: 5173,
    strictPort: true,
    // Same-origin /api → backend on IPv4. Avoids fetch to localhost:8000 hitting ::1 when
    // the API only listens on 127.0.0.1 (browser "NetworkError").
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
