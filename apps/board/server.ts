import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { loadCurrentContext, projectRoot } from '../host/context.js';
import { loadResearchIndex, parameterRows, readReviewFile } from './review-data.js';
import { fingerprint } from '../../src/runtime/records.js';

const loaded = await loadCurrentContext();
const context = {...loaded,base:loaded.economyBase};
const port = Number(process.env.PORT ?? 4317);
const types: Record<string, string> = { '.md': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method ?? '')) { res.writeHead(405); res.end(); return; }
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const path = decodeURIComponent(url.pathname);
    if (path === '/review-data') {
      const research = await loadResearchIndex(projectRoot, context.base);
      const body = JSON.stringify({ ...research, rules: context.base, implementation: context.implementation, rulesFingerprint: await fingerprint(context.base), parameters: parameterRows(context.base) });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(req.method === 'HEAD' ? undefined : body); return;
    }
    if (path === '/review-file') {
      const body = await readReviewFile(projectRoot, url.searchParams.get('path') ?? '');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(req.method === 'HEAD' ? undefined : body); return;
    }
    let absolute: string;
    if (path === '/') absolute = join(projectRoot, 'apps/board/entry.html');
    else if (path === '/start') absolute = join(projectRoot, 'apps/board/start.html');
    else if (path === '/play') absolute = join(projectRoot, 'apps/board/index.html');
    else if (path === '/ai') absolute = join(projectRoot, 'apps/board/ai.html');
    else if (path === '/ai-guide.md') absolute = join(projectRoot, 'docs/AI_PLAYER.md');
    else if (path === '/review') absolute = join(projectRoot, 'apps/board/review.html');
    else if (path === '/review.css') absolute = join(projectRoot, 'apps/board/review.css');
    else if (path === '/style.css') absolute = join(projectRoot, 'apps/board/style.css');
    else if (path === '/implementation.json') absolute = join(projectRoot, 'dist/implementation.json');
    else if (['/rulesets/social-eras.v27.json','/rulesets/social-eras.v26.json','/rulesets/social-eras.v25.json','/rulesets/social-eras.v24.json','/rulesets/social-eras.v23.json','/rulesets/social-eras.v22.json','/rulesets/branch-paths.v18.json','/rulesets/life-and-time.v17.json','/rulesets/megaproject-trial.v13.json','/rulesets/modern-grid.v14.json','/rulesets/agriculture-civilization.v15.json'].includes(path)) absolute = join(projectRoot, path.slice(1));
    else if (path.startsWith('/modules/') && path.endsWith('.js')) {
      const root = join(projectRoot, 'dist');
      absolute = resolve(root, path.slice('/modules/'.length));
      if (!absolute.startsWith(root + sep) || absolute.includes(`${sep}tests${sep}`) || absolute.includes(`${sep}apps${sep}cli${sep}`) || absolute.endsWith(`${sep}file-store.js`)) { res.writeHead(404); res.end(); return; }
    } else { res.writeHead(404); res.end(); return; }
    const body = await readFile(absolute);
    res.writeHead(200, { 'Content-Type': types[extname(absolute)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`规则桌面：http://127.0.0.1:${port}（仅本机）`));
