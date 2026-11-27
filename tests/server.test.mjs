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
        resolve({
          status: statusCode,
          headers,
          body: Buffer.concat(chunks).toString('utf8'),
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
