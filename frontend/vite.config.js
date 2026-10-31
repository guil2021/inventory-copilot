import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Lets the frontend call /api/... during local `npm run dev` without
    // hardcoding the backend's host. Defaults to localhost for running the
    // frontend directly on your machine; docker-compose overrides this to
    // "http://backend:4000" since containers can't reach each other via
    // localhost.
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
    },
  },
});
