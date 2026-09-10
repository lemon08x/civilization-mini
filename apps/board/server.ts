import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { loadContext, projectRoot } from '../cli/context.js';

await loadContext();
const port = Number(process.env.PORT ?? 4317);
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method ?? '')) { res.writeHead(405); res.end(); return; }
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
    let absolute: string;
    if (path === '/') absolute = join(projectRoot, 'apps/board/index.html');
    else if (path === '/style.css') absolute = join(projectRoot, 'apps/board/style.css');
    else if (path === '/implementation.json') absolute = join(projectRoot, 'dist/implementation.json');
    else if (path === '/rulesets/traditional-agriculture.v1.json') absolute = join(projectRoot, 'rulesets/traditional-agriculture.v1.json');
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
