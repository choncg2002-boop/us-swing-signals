import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Backend must run on 127.0.0.1:8000 (not localhost — avoids IPv6 mismatch on Windows) */
const BACKEND_HTTP = "http://127.0.0.1:8003";
const longTimeout = 600_000;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: BACKEND_HTTP,
        changeOrigin: true,
        secure: false,
        timeout: longTimeout,
        proxyTimeout: longTimeout,
      },
      // WebSocket: frontend connects directly to ws://127.0.0.1:8000 in dev (see websocket.ts)
    },
  },
});
