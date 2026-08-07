import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeBaseUrl(value = '/') {
  const trimmed = value.trim();

  if (!trimmed || trimmed === '/') return '/';

  const path = `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;

  if (!/^\/[A-Za-z0-9._~%/-]+\/$/.test(path)) {
    throw new Error('APP_BASE_URL must be a URL path such as "/" or "/tech".');
  }

  return path;
}

export default defineConfig({
  base: normalizeBaseUrl(process.env.APP_BASE_URL),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
