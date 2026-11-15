import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// The dev server's SPA fallback would answer /classic/ with the world's index.html.
// Point directory URLs for the passthrough site at its own index.html (build and Pages already do this).
const classicIndex = (): Plugin => ({
  name: 'classic-index',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = (req.url ?? '').split('?')[0];
      if (path === '/classic') {
        // Relative asset paths only resolve with the trailing slash.
        res.statusCode = 302;
        res.setHeader('Location', '/classic/');
        res.end();
        return;
      }
      if (path === '/classic/') req.url = '/classic/index.html';
      next();
    });
  },
});

export default defineConfig({
  plugins: [classicIndex()],
  build: {
    // Hashed output goes to /_app so it can't collide with content folders.
    assetsDir: '_app',
    target: 'es2022',
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
