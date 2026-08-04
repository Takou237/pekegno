import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // En dev, on proxy /api vers le backend Laravel pour éviter les soucis CORS
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // En dev, on proxy /storage pour afficher les fichiers uploadés (images de couverture)
      '/storage': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react') || id.includes('react-router') || id.includes('scheduler')) {
            return 'react-vendor';
          }
          if (id.includes('axios')) return 'http';
          if (id.includes('i18next')) return 'i18n';
          if (id.includes('lucide')) return 'icons';
          if (id.includes('qrcode')) return 'qrcode';
          return 'vendor';
        },
      },
    },
  },
});
