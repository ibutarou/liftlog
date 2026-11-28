import test from 'node:test';
import assert from 'node:assert/strict';
import server, { handleRequest } from '../server.mjs';

function invokeHandler({ method = 'GET', url = '/' } = {}) {
  return new Promise((resolve, reject) => {
    let statusCode = 0;
    let headers = {};
    const chunks = [];

    const req = { method, url };
    const res = {
      headersSent: false,
      writeHead(code, hdrs = {}) {
        statusCode = code;
        headers = Object.fromEntries(
          Object.entries(hdrs).map(([k, v]) => [k.toLowerCase(), String(v)])
        );
        this.headersSent = true;
      },
      end(chunk) {
        if (chunk !== undefined && chunk !== null) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        const rawBody = Buffer.concat(chunks);
        resolve({
          status: statusCode,
          headers,
          body: rawBody.toString('utf8'),
          rawBody,
        });
      },
    };

    handleRequest(req, res).catch(reject);
  });
}

test('Importing server.mjs does not auto-listen', () => {
  assert.equal(server.listening, false);
});

test('GET / serves index.html with text/html content type', async () => {
  const res = await invokeHandler({ method: 'GET', url: '/' });
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
  assert.ok(res.body.includes('<link rel="stylesheet" href="styles.css" />'));
});

test('GET /styles.css and query-string variant serve CSS with text/css content type', async () => {
  for (const url of ['/styles.css', '/styles.css?v=1']) {
    const res = await invokeHandler({ method: 'GET', url });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/css; charset=utf-8');
    assert.ok(res.body.length > 0);
    assert.ok(res.body.includes(':root'));
    assert.equal(Number(res.headers['content-length']), Buffer.byteLength(res.body));
  }
});

test('HEAD /styles.css returns 200 with text/css and empty body', async () => {
  const res = await invokeHandler({ method: 'HEAD', url: '/styles.css' });
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'text/css; charset=utf-8');
  assert.ok(Number(res.headers['content-length']) > 0);
  assert.equal(res.body, '');
});

test('All /src/*.js scripts return 200 with application/javascript content type', async () => {
  const scripts = [
    '/src/constants.js',
    '/src/calculations.js',
    '/src/sampleData.js',
    '/src/storage.js',
    '/src/charts.js',
    '/src/app.js',
  ];

  for (const url of scripts) {
    const res = await invokeHandler({ method: 'GET', url });
    assert.equal(res.status, 200, `Expected 200 for ${url}`);
    assert.equal(res.headers['content-type'], 'application/javascript; charset=utf-8');
    assert.ok(res.body.length > 0);
  }
});

test('Unlisted internal files, traversal paths, and missing assets return 404', async () => {
  for (const url of ['/server.mjs', '/package.json', '/../etc/passwd', '/missing.css']) {
    const res = await invokeHandler({ method: 'GET', url });
    assert.equal(res.status, 404, `Expected 404 for ${url}`);
  }
});

test('Malformed URI returns 400 and POST /styles.css returns 405 Method Not Allowed', async () => {
  const badUri = await invokeHandler({ method: 'GET', url: '/%E0%A4%A' });
  assert.equal(badUri.status, 400);

  const postRes = await invokeHandler({ method: 'POST', url: '/styles.css' });
  assert.equal(postRes.status, 405);
  assert.equal(postRes.headers.allow, 'GET, HEAD');
});

test('GET / includes web app manifest, favicon, and apple-touch-icon links', async () => {
  const res = await invokeHandler({ method: 'GET', url: '/' });
  assert.equal(res.status, 200);
  assert.ok(res.body.includes('<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />'));
  assert.ok(res.body.includes('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" sizes="180x180" />'));
  assert.ok(res.body.includes('<link rel="manifest" href="/manifest.webmanifest" />'));
});

test('GET /manifest.webmanifest and /icons/icon.svg return valid metadata and SVG', async () => {
  const manifestRes = await invokeHandler({ method: 'GET', url: '/manifest.webmanifest' });
  assert.equal(manifestRes.status, 200);
  assert.equal(manifestRes.headers['content-type'], 'application/manifest+json; charset=utf-8');
  const manifest = JSON.parse(manifestRes.body);
  assert.equal(manifest.short_name, 'マチョめも');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.src === '/icons/icon-192.png'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.src === '/icons/icon-512.png'));
  assert.ok(manifest.icons.some((icon) => icon.type === 'image/svg+xml' && icon.src === '/icons/icon.svg'));

  const svgRes = await invokeHandler({ method: 'GET', url: '/icons/icon.svg' });
  assert.equal(svgRes.status, 200);
  assert.equal(svgRes.headers['content-type'], 'image/svg+xml; charset=utf-8');
  assert.ok(svgRes.body.includes('<svg') && svgRes.body.includes('viewBox="0 0 512 512"'));
});

test('PNG icon endpoints and HEAD /icons/apple-touch-icon.png return valid PNG dimensions', async () => {
  const pngCases = [
    { url: '/icons/icon-32.png', width: 32, height: 32 },
    { url: '/icons/apple-touch-icon.png', width: 180, height: 180 },
    { url: '/apple-touch-icon.png', width: 180, height: 180 },
    { url: '/icons/icon-192.png', width: 192, height: 192 },
    { url: '/icons/icon-512.png', width: 512, height: 512 },
  ];
  const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  for (const item of pngCases) {
    const res = await invokeHandler({ method: 'GET', url: item.url });
    assert.equal(res.status, 200, `Expected 200 for ${item.url}`);
    assert.equal(res.headers['content-type'], 'image/png');
    assert.ok(res.rawBody.subarray(0, 8).equals(pngMagic), `Invalid PNG signature for ${item.url}`);
    assert.equal(res.rawBody.readUInt32BE(16), item.width);
    assert.equal(res.rawBody.readUInt32BE(20), item.height);
  }

  const headRes = await invokeHandler({ method: 'HEAD', url: '/icons/apple-touch-icon.png' });
  assert.equal(headRes.status, 200);
  assert.equal(headRes.headers['content-type'], 'image/png');
  assert.ok(Number(headRes.headers['content-length']) > 0);
  assert.equal(headRes.rawBody.length, 0);
});
