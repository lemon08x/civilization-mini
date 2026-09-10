import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
const root = resolve('dist/src/game');
const paths = (await readdir(root, { recursive: true })).filter(name => name.endsWith('.js')).sort();
const hash = createHash('sha256');
for (const name of paths) { hash.update(name.replaceAll('\\', '/')); hash.update('\n'); hash.update((await readFile(resolve(root, name), 'utf8')).replaceAll('\r\n', '\n')); hash.update('\n'); }
await writeFile('dist/implementation.json', JSON.stringify({ version: '0.2.0', codeFingerprint: hash.digest('hex') }, null, 2));
console.log(`Built rule identity from ${paths.length} modules in ${relative(process.cwd(), root)}.`);
