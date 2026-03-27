import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 + IPv6. On Windows, default [::1]-only breaks http://localhost → 127.0.0.1.
    host: true,
    port: 5173,
    strictPort: true,
  },
});

