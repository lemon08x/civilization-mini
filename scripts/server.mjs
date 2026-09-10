import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT ?? 4317);
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const path = decodeURIComponent(url.pathname === '/' ? '/web/index.html' : url.pathname);
    if (!path.startsWith('/web/') && !path.startsWith('/src/')) { res.writeHead(404); res.end(); return; }
    const absolute = resolve(root, `.${path}`);
    if (!absolute.startsWith(root.endsWith(sep) ? root : root + sep) || !types[extname(absolute)]) { res.writeHead(404); res.end(); return; }
    const body = await readFile(absolute);
    res.writeHead(200, { 'Content-Type': types[extname(absolute)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`规则桌面：http://127.0.0.1:${port}（仅本机）`));
