import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveAppBasePath, resolveAppBaseUrl } from './scripts/app-base-url.mjs';

const APP_BASE_URL = resolveAppBaseUrl();
const appBasePath = resolveAppBasePath();
const viteBase = `${appBasePath || ''}/`;
const apiPath = `${appBasePath}/api`;

export default defineConfig({
  base: viteBase,
  define: {
    __APP_BASE_URL__: JSON.stringify(APP_BASE_URL),
  },
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      [apiPath]: {
        target: 'http://localhost:3000',
        rewrite: (requestPath) => requestPath.replace(apiPath, '/api'),
      },
    },
  },
});
