import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:4001';
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': { target }, '/socket.io': { target, ws: true } },
    },
    build: {
      // Generate source maps for production error tracking (hidden = not exposed to users)
      sourcemap: 'hidden',
      // Chunk splitting for optimal caching
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/'))
              return 'vendor-react';
            if (id.includes('node_modules/react-router')) return 'vendor-router';
            if (id.includes('node_modules/@hello-pangea/dnd')) return 'vendor-dnd';
            if (id.includes('node_modules/socket.io')) return 'vendor-socket';
          },
        },
      },
      // Warn about large chunks
      chunkSizeWarningLimit: 500,
    },
    test: { environment: 'jsdom', setupFiles: ['./tests/setup.js'] },
  };
});
