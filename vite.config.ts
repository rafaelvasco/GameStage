import { defineConfig } from "vite";

export default defineConfig({
  // Base configuration
  base: "./",

  // Build options
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
  },

  // Server options
  server: {
    port: 3000,
    open: true,
  },
});
