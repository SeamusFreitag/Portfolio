import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = process.env.PORT || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

async function tryFiles(pathname) {
  const candidates = [];
  const clean = decodeURIComponent(pathname.split('?')[0]);
  if (clean.endsWith('/')) {
    candidates.push(join(DIST, clean, 'index.html'));
  } else {
    candidates.push(join(DIST, clean));
    candidates.push(join(DIST, clean + '.html'));
    candidates.push(join(DIST, clean, 'index.html'));
  }
  for (const c of candidates) {
    try { const s = await stat(c); if (s.isFile()) return c; } catch { /* next */ }
  }
  return null;
}

createServer(async (req, res) => {
  let file = await tryFiles(req.url || '/');
  let status = 200;
  if (!file) { file = join(DIST, '404.html'); status = 404; }
  try {
    const data = await readFile(file);
    res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(500); res.end('500');
  }
}).listen(PORT, () => {
  console.log(`Preview → http://localhost:${PORT}`);
});
