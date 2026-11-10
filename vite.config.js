import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  server: {
    port: 8551,
    strictPort: true,
    // Yahoo Finance sends no CORS headers; the stock-signals mock syncs through this on localhost
    proxy: {
      '/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo/, ''),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      },
    },
  },
  preview: {
    port: 8551,
    strictPort: true,
  },
  build: {
    outDir: 'docs',
  },
  assetsInclude: ['**/*.md'],
})
