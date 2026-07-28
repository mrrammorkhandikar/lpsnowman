import fs from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const frontendEnvDir = path.resolve(__dirname);
  const backendEnvDir = path.resolve(__dirname, "../backend");
  const env = {
    ...loadEnv(mode, frontendEnvDir, ""),
    ...(fs.existsSync(backendEnvDir) ? loadEnv(mode, backendEnvDir, "") : {}),
  };
  
  // Get API key from environment only — never hardcode secrets here
  const googleMapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || 
                           env.VITE_GOOGLE_MAPS_API_KEY || 
                           "";

  if (!googleMapsApiKey) {
    console.warn('[Vite] WARNING: VITE_GOOGLE_MAPS_API_KEY is not set. Address autocomplete will not work.');
  }
  
  const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 
                         env.VITE_API_PROXY_TARGET || 
                         "http://localhost:5000";

  const gaMeasurementId = process.env.VITE_GA_MEASUREMENT_ID ||
                          env.VITE_GA_MEASUREMENT_ID ||
                          "";

  console.log('[Vite] Google Maps API Key:', googleMapsApiKey ? `${googleMapsApiKey.substring(0, 10)}...` : 'NOT SET');
  console.log('[Vite] API Proxy Target:', apiProxyTarget);

  return {
    envDir: frontendEnvDir,
    // Explicitly define env variables for Vite to expose to client
    define: {
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(googleMapsApiKey),
      'import.meta.env.VITE_API_PROXY_TARGET': JSON.stringify(apiProxyTarget),
      'import.meta.env.VITE_GA_MEASUREMENT_ID': JSON.stringify(gaMeasurementId),
    },
    plugins: [
      react(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@shared": path.resolve(__dirname, "src/shared"),
        "@assets": path.resolve(__dirname, "../backend/attached_assets"),
      },
    },
    root: ".", 
    build: {
      outDir: "dist",
      emptyOutDir: true,
      assetsDir: "static/assets",
       sourcemap: "hidden",
    },
    optimizeDeps: {
      // Forcing re-optimize on every start is very memory-heavy; opt in with VITE_OPTIMIZE_DEPS_FORCE=true if deps look stale.
      force: process.env.VITE_OPTIMIZE_DEPS_FORCE === "true",
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: 'all',
      hmr: {
        clientPort: 5173,
        host: 'localhost',
        protocol: 'ws',
      },
      proxy: {
        // Large/binary uploads must outlive the default proxy idle timeout (~2m or less).
        "/api/uploads/upload-file": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: "",
          cookiePathRewrite: "/",
          timeout: 180000,
          proxyTimeout: 180000,
        },
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: "",
          cookiePathRewrite: "/",
        },
        "/ws": {
          target: apiProxyTarget,
          changeOrigin: true,
          ws: true,
          secure: false,
        },
        "/assets": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        "/objects": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: "",
          cookiePathRewrite: "/",
        },
      }
    }
  };
});
