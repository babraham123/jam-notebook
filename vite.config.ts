import { defineConfig } from "vite";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { viteSingleFile } from "vite-plugin-singlefile";

// https://vitejs.dev/config/
export default defineConfig({
  root: "./ui-src",
  plugins: [
    nodePolyfills({
      // exclude: [
      //   'fs',
      //   'path',
      // ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    viteSingleFile(),
  ],
  build: {
    target: "esnext",
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    reportCompressedSize: false,
    outDir: "../dist",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        // manualChunks: () => 'everything.js',
      },
    },
  },
});
