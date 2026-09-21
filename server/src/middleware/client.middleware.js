import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';

export function mountClient(app, directory) {
  const index = path.join(directory, 'index.html');
  if (!existsSync(index))
    throw new Error('Client build is missing. Run npm run build before starting production.');
  app.use(
    express.static(directory, {
      index: false,
      redirect: false,
      dotfiles: 'ignore',
      setHeaders(res, file) {
        res.set(
          'Cache-Control',
          path.dirname(file) === path.join(directory, 'assets')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        );
      },
    }),
  );
  app.get('/{*path}', (req, res, next) => {
    // Missing assets and API paths must remain real 404 responses.
    if (
      path.extname(req.path) ||
      req.path.split('/').some((part) => part.startsWith('.')) ||
      !req.accepts('html')
    )
      return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile('index.html', { root: directory });
  });
}
