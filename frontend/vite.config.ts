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
});
