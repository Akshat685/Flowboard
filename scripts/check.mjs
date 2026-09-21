import { readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
function check(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', '.local', '.test-artifacts'].includes(item.name)) continue;
    const file = resolve(dir, item.name);
    if (item.isDirectory()) check(file);
    else if (['.js', '.mjs'].includes(extname(file))) {
      const result = spawnSync(process.execPath, ['--check', file], {
        stdio: 'inherit',
        windowsHide: true,
      });
      if (result.error) throw result.error;
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }
}
check(root);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script using npm run check');
const lint = spawnSync(process.execPath, [npmCli, 'run', 'lint'], {
  stdio: 'inherit',
  windowsHide: true,
});
if (lint.error) throw lint.error;
process.exit(lint.status ?? 1);
