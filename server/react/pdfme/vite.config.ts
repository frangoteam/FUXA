import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/api/pdfme-static/',
  build: { 
    target: 'esnext',
    sourcemap: true // Enable source maps for production builds
  },
  plugins: [react(), sentryVitePlugin({
    org: "hand-dot",
    project: "playground-pdfme"
  })],
});