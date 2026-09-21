import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = ['--watch'];
// Explicit paths prevent dependency/cache notifications from restarting requests.
if (['win32', 'darwin'].includes(process.platform)) {
  args.push('--watch-path=src', '--watch-path=../shared');
}
const child = spawn(process.execPath, [...args, 'src/server.js'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  stdio: 'inherit',
  windowsHide: true,
});
child.on('error', (error) => {
  console.error('Development server failed:', error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
