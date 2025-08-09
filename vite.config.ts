import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "WebSocketPro",
      fileName: (format) => `websocket-pro.${format}.js`,
    },
    rollupOptions: {
      external: ["pako"],
      output: {
        globals: {
          pako: "pako",
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ["src/**/*"],
    }),
  ],
});
