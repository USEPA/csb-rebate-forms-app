import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  build: {
    outDir: "build",
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: "static/js/[name]-[hash].js",
        chunkFileNames: "static/js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const extension = [...assetInfo.name.split(".")].pop();
          const directory = /\.(css)$/.test(assetInfo.name)
            ? "static/css"
            : /\.(woff|woff2|eot|ttf|otf)$/.test(assetInfo.name)
            ? "static/fonts"
            : /\.(png|jpe?g|gif|svg|webp|webm|mp3)$/.test(assetInfo.name)
            ? "static/media"
            : "static";
          return `${directory}/[name]-[hash].${extension}`;
        },
      },
    },
  },
  define: {
    "process.env": {},
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    open: true,
    port: 3000,
    proxy: {
      "/api": "http://localhost:3001",
      "/login": "http://localhost:3001",
      "/logout": "http://localhost:3001",
    },
  },
});
