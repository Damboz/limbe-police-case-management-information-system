import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Only used by `npm run dev`. In production the browser talks to the deployed API
// directly, so VITE_API_URL is baked in at build time and the proxy is irrelevant.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3000';

// The PDF reports sit outside /api, so they are proxied too. Fetching them through
// the dev server keeps the session cookie same-origin, exactly as in production.
const proxied = ['/api', '/reports', '/supervisor/reports'];

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: Object.fromEntries(
            proxied.map(path => [path, { target: API_TARGET, changeOrigin: true }])
        )
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    }
});