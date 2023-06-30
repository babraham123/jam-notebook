import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// import { cssModulesPlugin } from "./build/vendor/css-module-plugin.mjs";

// https://vitejs.dev/config/
export default defineConfig({
  root: './ui-src',
  plugins: [viteSingleFile()], // , cssModulesPlugin()],
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    brotliSize: false,
    outDir: '../dist',
    rollupOptions: {
      inlineDynamicImports: true,
      output: {
        manualChunks: () => 'everything.js',
      },
    },
  },
})
