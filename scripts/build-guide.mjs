import { readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const template = readFileSync(resolve(root, 'docs/guide.template.md'), 'utf8');
const languages = {
  '.json': 'json',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.jsx': 'jsx',
  '.css': 'css',
  '.html': 'html',
  '.yml': 'yaml',
};
const output = template.replace(/\{\{(file|filetext):([^}]+)\}\}/g, (_, kind, name) => {
  const path = resolve(root, name);
  if (
    !path.startsWith(root.endsWith(sep) ? root : root + sep) ||
    (/(?:^|[\\/])\.env(?:\.[^\\/]*)?$/.test(name) && !name.endsWith('.example'))
  ) {
    throw new Error(`Refusing to embed ${name}`);
  }
  const content = readFileSync(path, 'utf8').trimEnd();
  if (kind === 'filetext') return content;
  return `### File: \`${name}\`\n\n\`\`\`${languages[extname(name)] || 'text'}\n${content}\n\`\`\``;
});
if (/\{\{(?:file|filetext):/.test(output))
  throw new Error('An unresolved source placeholder remains');
writeFileSync(resolve(root, 'README.md'), output);
console.log(`Generated README.md (${output.split('\n').length} lines) from current source files.`);
