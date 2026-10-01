import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const allowedDirectories = new Set(['data', 'icons', 'vendor']);
const nhlPaths = [
  /^roster\/[A-Z]{3}\/current$/,
  /^player\/[0-9]+\/landing$/,
  /^club-schedule-season\/[A-Z]{3}\/current$/,
  /^standings\/now$/,
];

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Invalid URL');
    return;
  }
  if (pathname.startsWith('/nhl-api/')) {
    const apiPath = pathname.slice('/nhl-api/v1/'.length);
    if (!pathname.startsWith('/nhl-api/v1/') || !nhlPaths.some((pattern) => pattern.test(apiPath))) {
      response.writeHead(404).end('Not found');
      return;
    }
    try {
      const upstream = await fetch(`https://api-web.nhle.com/v1/${apiPath}`, {
        signal: AbortSignal.timeout(12000),
      });
      if (!upstream.ok) {
        console.warn(`NHL API ${apiPath}: HTTP ${upstream.status}`);
        response.writeHead(upstream.status).end('NHL API request failed');
        return;
      }
      const body = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': body.length,
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      console.error(`NHL API ${apiPath} unavailable`, error);
      response.writeHead(502).end('NHL API unavailable');
    }
    return;
  }
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => segment.startsWith('.') || segment === '..')
    || (segments.length > 1 && !allowedDirectories.has(segments[0]))) {
    response.writeHead(404).end('Not found');
    return;
  }
  const filename = segments.length ? resolve(root, ...segments) : resolve(root, 'index.html');
  if (!filename.startsWith(`${root}${sep}`) || !mimeTypes[extname(filename)]) {
    response.writeHead(404).end('Not found');
    return;
  }

  try {
    const fileStat = await stat(filename);
    if (!fileStat.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    const body = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filename)],
      'Content-Length': body.length,
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.writeHead(404).end('Not found');
      return;
    }
    console.error(`Unable to serve ${filename}`, error);
    response.writeHead(500).end('Server error');
  }
});

server.on('error', (error) => {
  console.error('Dashboard launcher failed:', error);
  process.exitCode = 1;
});
server.listen(3000, '0.0.0.0', () => {
  console.log('Hockey Dashboard: http://127.0.0.1:3000/index.html');
  const lanAddresses = [...new Set(Object.values(networkInterfaces()).flat()
    .filter((address) => address.family === 'IPv4' && !address.internal && !address.address.startsWith('169.254.'))
    .map((address) => address.address))];
  if (lanAddresses.length) {
    lanAddresses.forEach((address) => console.log(`Mobile (same network): http://${address}:3000/index.html`));
  } else {
    console.warn('No LAN IPv4 address found. Connect this computer to the same network as your phone.');
  }
});
