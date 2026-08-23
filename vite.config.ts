import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Production composes the standalone 3D viewer's own index.html into
// dist/viewer3d (scripts/fetch-viewer3d.ts) and Firebase Hosting rewrites
// /viewer3d/** to it. The dev server has no equivalent rewrite: Vite's SPA
// fallback treats any extensionless /viewer3d/... request (including the
// #d=... share link "View in 3D" navigates to) as this app's own client
// route and serves this app's index.html instead - which is why the
// composed viewer never loads locally even after copying its build into
// public/viewer3d. Registered synchronously (not as a post hook) so it runs
// ahead of that fallback. Local dev convenience only; unused by `vite build`.
function viewer3dDevFallback(): Plugin {
  return {
    name: 'viewer3d-dev-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) { next(); return; }
        // The bare path (no trailing slash) is outside the /viewer3d/**
        // glob Firebase Hosting rewrites in production too, so a canonical
        // redirect matches real behavior rather than papering over a
        // dev-only gap.
        if (req.url === '/viewer3d' || req.url.startsWith('/viewer3d?')) {
          res.writeHead(308, { Location: req.url.replace('/viewer3d', '/viewer3d/') });
          res.end();
          return;
        }
        if (req.url.startsWith('/viewer3d/') && !req.url.slice('/viewer3d/'.length).includes('.')) {
          req.url = '/viewer3d/index.html';
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viewer3dDevFallback()],
})
