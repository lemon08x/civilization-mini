import http from 'node:http';
import {spawn} from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { loadCurrentContext, projectRoot } from '../host/context.js';

await loadCurrentContext();
const port = Number(process.env.PORT ?? 4317);
const types: Record<string, string> = { '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.md': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method ?? '')) { res.writeHead(405); res.end(); return; }
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const path = decodeURIComponent(url.pathname);
    let absolute: string;
    if (path === '/') absolute = join(projectRoot, 'apps/board/entry.html');
    else if (path === '/vendor/lunar-typescript.mjs') absolute = join(projectRoot, 'node_modules/lunar-typescript/dist/index.mjs');
    else if (path === '/vendor/pixi.js') absolute = join(projectRoot, 'node_modules/pixi.js-legacy/dist/pixi-legacy.min.js');
    else if (path === '/start') absolute = join(projectRoot, 'apps/board/start.html');
    else if (path === '/crop-preview') absolute = join(projectRoot, 'apps/board/crop-preview.html');
    else if (path === '/play') absolute = join(projectRoot, 'apps/board/index.html');
    else if (path === '/ai') absolute = join(projectRoot, 'apps/board/ai.html');
    else if (path === '/ai-guide.md') absolute = join(projectRoot, 'docs/AI_PLAYER.md');
    else if (path === '/style.css') absolute = join(projectRoot, 'apps/board/style.css');
    else if (path === '/farm-animation/scene.css') absolute = join(projectRoot, 'apps/board/farm-animation/scene.css');
    else if (path.startsWith('/illustrations/') && ['.png','.jpg','.webp'].includes(extname(path))) {
      const root = join(projectRoot, 'apps/board/illustrations');
      absolute = resolve(root, path.slice('/illustrations/'.length));
      if (!absolute.startsWith(root + sep)) { res.writeHead(404); res.end(); return; }
    }
    else if (path === '/rulesets/current.json') {
      try {
        // Serve the current files; the shared game engine validates them in the client.
        // A long-lived HTTP process must not pair a stale validator with newly built rules.
        const [meta,parameters,systems,legacy,scenarios,catalogs] = await Promise.all(
          ['meta','parameters','systems','legacy','scenarios','catalogs'].map(async name => JSON.parse(await readFile(join(projectRoot,'rulesets/v27',name+'.json'),'utf8')) as Record<string,unknown>)
        );
        const base = {...meta,...parameters,...legacy,...systems,scenarios,catalogs};
        const body = Buffer.from(JSON.stringify(base), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(req.method === 'HEAD' ? undefined : body);
      } catch (cause) {
        console.error('规则加载失败：', cause);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ error: '规则加载失败，请重启游戏服务并检查终端错误。' }));
      }
      return;
    }
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
server.listen(port, '127.0.0.1', () => {
  const url=`http://127.0.0.1:${port}/start`;
  console.log(`规则桌面：${url}（仅本机）`);
  if(process.env.OPEN_BROWSER==='1'&&process.platform==='win32'){
    const browser=spawn('explorer.exe',[url],{windowsHide:true,stdio:'ignore'});
    browser.on('error',()=>console.log(`请手动在浏览器打开：${url}`));
    browser.unref();
  }
});
