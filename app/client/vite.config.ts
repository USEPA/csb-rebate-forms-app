import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  const { VITE_SERVER_BASE_PATH } = process.env;

  // allows the app to be accessed from a sub directory of a server (e.g. /csb)
  const serverBasePath =
    mode === "development" ? "" : VITE_SERVER_BASE_PATH || "";

  return defineConfig({
    base: serverBasePath,
    build: {
      outDir: "build",
      sourcemap: true,
      rollupOptions: {
        /*
          NOTE: The following is required to avoid a bug with a GitHub Action
          workflow including `regenerator-runtime` in the build as an external
          dependency.

          For reference, the GitHub Action workflow's log message stated:
          "regenerator-runtime/runtime.js" is imported by "regenerator-runtime/runtime.js?commonjs-external",
          but could not be resolved – treating it as an external dependency.
        */
        external: ["regenerator-runtime"],
        output: {
          entryFileNames: "static/js/[name]-[hash].js",
          chunkFileNames: "static/js/[name]-[hash].js",
          assetFileNames: (chunkInfo) => {
            const extension = [...chunkInfo.name.split(".")].pop();
            const directory = /\.(css)$/.test(chunkInfo.name)
              ? "static/css"
              : /\.(woff|woff2|eot|ttf|otf)$/.test(chunkInfo.name)
              ? "static/fonts"
              : /\.(png|jpe?g|gif|svg|webp|webm|mp3)$/.test(chunkInfo.name)
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
};
