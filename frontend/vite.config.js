import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rawBasePath = process.env.APP_BASE_PATH || '/tech-prod';
const normalizedBasePath = `/${rawBasePath.replace(/^\/+|\/+$/g, '')}/`;

export default defineConfig({
  base: normalizedBasePath,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      [`${normalizedBasePath.replace(/\/$/, '')}/api`]: {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(`${normalizedBasePath.replace(/\/$/, '')}/api`, '/api'),
      },
    },
  },
});
