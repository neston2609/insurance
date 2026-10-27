import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: command === "build" ? "/manage/" : "/",
    plugins: [react(), tailwindcss()],
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://127.0.0.1:3001",
          changeOrigin: false,
        },
      },
    },
    build: { outDir: "dist/client" },
  };
});
