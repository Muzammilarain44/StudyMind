import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // In dev, relative /api calls go to the Express backend.
      '/api': 'http://localhost:5000',
    },
  },
});
