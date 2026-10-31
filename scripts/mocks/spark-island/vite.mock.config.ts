import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// one JS file and one CSS file, so the mock can be inlined into a single HTML page
export default defineConfig({
  plugins: [tailwindcss()],
  base: './',
  build: {
    outDir: 'dist-mock',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 5000,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
