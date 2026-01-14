import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({mode}) => ({
  base: "./",
  assetsInclude: ["**/*.wasm"],
  plugins: [
    react({
      jsxRuntime: "classic",
      include: /\.[jt]sx?$/,
      babel: {
        plugins: [
          ["@babel/plugin-proposal-decorators", {legacy: true}],
          ["@babel/plugin-transform-class-properties", {loose: true}],
        ],
      },
    }),
  ],
  optimizeDeps: {
    entries: ["index.html"],
    exclude: ["react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  resolve: {
    alias: [{find: /^antd$/, replacement: "antd/lib"}],
  },
  build: {
    outDir: "docs"
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode),
    "process.env.PUBLIC_URL": JSON.stringify(""),
    global: "globalThis",
  },
}));
