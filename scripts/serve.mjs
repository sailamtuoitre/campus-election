import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('web');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = pathname === '/ethers.js' ? path.resolve('node_modules/ethers/dist/ethers.min.js')
      : path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (pathname !== '/ethers.js' && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end(); return;
    }
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404).end('Not found. Run npm run deploy first if deployment.json is missing.'); }
}).listen(8080, '127.0.0.1', () => console.log('Campus Election: http://127.0.0.1:8080'));
