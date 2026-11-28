import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);

// Keep literal path.join(ROOT_DIR, '...') expressions so @vercel/nft traces all assets.
const STATIC_ASSETS = {
  '/': {
    filePath: path.join(ROOT_DIR, 'index.html'),
    relPath: 'index.html',
    contentType: 'text/html; charset=utf-8',
  },
  '/index.html': {
    filePath: path.join(ROOT_DIR, 'index.html'),
    relPath: 'index.html',
    contentType: 'text/html; charset=utf-8',
  },
  '/styles.css': {
    filePath: path.join(ROOT_DIR, 'styles.css'),
    relPath: 'styles.css',
    contentType: 'text/css; charset=utf-8',
  },
  '/src/constants.js': {
    filePath: path.join(ROOT_DIR, 'src/constants.js'),
    relPath: 'src/constants.js',
    contentType: 'application/javascript; charset=utf-8',
  },
  '/src/calculations.js': {
    filePath: path.join(ROOT_DIR, 'src/calculations.js'),
    relPath: 'src/calculations.js',
    contentType: 'application/javascript; charset=utf-8',
  },
  '/src/sampleData.js': {
    filePath: path.join(ROOT_DIR, 'src/sampleData.js'),
    relPath: 'src/sampleData.js',
    contentType: 'application/javascript; charset=utf-8',
  },
  '/src/storage.js': {
    filePath: path.join(ROOT_DIR, 'src/storage.js'),
    relPath: 'src/storage.js',
    contentType: 'application/javascript; charset=utf-8',
  },
  '/src/charts.js': {
    filePath: path.join(ROOT_DIR, 'src/charts.js'),
    relPath: 'src/charts.js',
    contentType: 'application/javascript; charset=utf-8',
  },
  '/src/app.js': {
    filePath: path.join(ROOT_DIR, 'src/app.js'),
    relPath: 'src/app.js',
    contentType: 'application/javascript; charset=utf-8',
  },
  '/manifest.webmanifest': {
    filePath: path.join(ROOT_DIR, 'manifest.webmanifest'),
    relPath: 'manifest.webmanifest',
    contentType: 'application/manifest+json; charset=utf-8',
  },
  '/icons/icon.svg': {
    filePath: path.join(ROOT_DIR, 'icons/icon.svg'),
    relPath: 'icons/icon.svg',
    contentType: 'image/svg+xml; charset=utf-8',
  },
  '/icons/icon-32.png': {
    filePath: path.join(ROOT_DIR, 'icons/icon-32.png'),
    relPath: 'icons/icon-32.png',
    contentType: 'image/png',
  },
  '/icons/apple-touch-icon.png': {
    filePath: path.join(ROOT_DIR, 'icons/apple-touch-icon.png'),
    relPath: 'icons/apple-touch-icon.png',
    contentType: 'image/png',
  },
  '/apple-touch-icon.png': {
    filePath: path.join(ROOT_DIR, 'icons/apple-touch-icon.png'),
    relPath: 'icons/apple-touch-icon.png',
    contentType: 'image/png',
  },
  '/icons/icon-192.png': {
    filePath: path.join(ROOT_DIR, 'icons/icon-192.png'),
    relPath: 'icons/icon-192.png',
    contentType: 'image/png',
  },
  '/icons/icon-512.png': {
    filePath: path.join(ROOT_DIR, 'icons/icon-512.png'),
    relPath: 'icons/icon-512.png',
    contentType: 'image/png',
  },
};

async function readStaticAsset(asset) {
  try {
    return await fs.readFile(asset.filePath);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      const cwdPath = path.join(process.cwd(), asset.relPath);
      if (cwdPath !== asset.filePath) {
        return fs.readFile(cwdPath);
      }
    }
    throw err;
  }
}

export async function handleRequest(req, res) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, {
      'Content-Type': 'text/plain; charset=utf-8',
      Allow: 'GET, HEAD',
    });
    res.end('Method Not Allowed');
    return;
  }

  const rawUrl = (req.url || '/').split('?')[0];
  let pathname = '/';
  try {
    pathname = decodeURIComponent(rawUrl);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  const asset = STATIC_ASSETS[pathname];
  if (!asset) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  try {
    const data = await readStaticAsset(asset);
    res.writeHead(200, {
      'Content-Type': asset.contentType,
      'Content-Length': String(Buffer.byteLength(data)),
      'Cache-Control': 'public, max-age=0, must-revalidate',
    });
    if (method === 'HEAD') {
      res.end();
    } else {
      res.end(data);
    }
  } catch (err) {
    const status = err && err.code === 'ENOENT' ? 404 : 500;
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(status === 404 ? 'Not Found' : 'Internal Server Error');
  }
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(() => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Internal Server Error');
  });
});

const isDirectEntry =
  !process.env.VERCEL &&
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === __filename;

if (isDirectEntry) {
  const HOST = process.env.HOST || '127.0.0.1';
  const PORT = Number(process.env.PORT) || 4173;
  server.listen(PORT, HOST, () => {
    console.log(`マチョめも server running at http://${HOST}:${PORT}`);
  });
}

export default server;
