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
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // React, ReactDOM et scheduler restent DANS LE MÊME chunk :
          // un split entre react et react-dom cassait React 19.2
          // ("Cannot set properties of undefined (setting 'Activity')").
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'react';
          }
          return 'vendor';
        },
      },
    },
  },
});
