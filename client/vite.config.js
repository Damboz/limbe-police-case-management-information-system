import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3000';

const proxied = ['/api', '/css', '/js', '/logo', '/reports', '/supervisor/reports'];

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
