import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
for (const name of ['server/.env', 'client/.env']) {
  const target = new URL(name, root);
  if (existsSync(target)) {
    console.log(`Keeping existing ${name}`);
    continue;
  }
  let content = readFileSync(new URL(`${name}.example`, root), 'utf8');
  content = content.replace(
    'REPLACE_WITH_A_RANDOM_SECRET_USING_NPM_RUN_SETUP',
    randomBytes(48).toString('hex'),
  );
  writeFileSync(target, content, { flag: 'wx', mode: 0o600 });
  console.log(`Created ${fileURLToPath(target)}`);
}
