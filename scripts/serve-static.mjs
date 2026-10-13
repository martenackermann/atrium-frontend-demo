#!/usr/bin/env node
/**
 * Serves the static demo build like Vercel does (vercel.json): files from `.output/public`, and
 * index.html for every other path (SPA fallback). No dependencies.
 *
 *   pnpm build:demo && pnpm preview:demo          # http://localhost:4173
 *   node scripts/serve-static.mjs <dir> <port>
 *
 * Playwright uses it for `E2E_STATIC=1 pnpm test:e2e` (CI runs the e2e suite against the build).
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const root = resolve(process.argv[2] ?? '.output/public')
const port = Number(process.argv[3] ?? process.env.PORT ?? 4173)

if (!existsSync(join(root, 'index.html'))) {
  console.error(`[serve-static] ${root}/index.html not found. Run \`pnpm build:demo\` first.`)
  process.exit(1)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

/** The file for a URL path, or null (never outside `root`). */
function fileFor(urlPath) {
  let path
  try {
    path = decodeURIComponent(urlPath.split('?')[0] ?? '/')
  } catch {
    return null
  }
  const candidate = normalize(join(root, path))
  if (candidate !== root && !candidate.startsWith(root + sep)) return null
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  const index = join(candidate, 'index.html')
  if (existsSync(index) && statSync(index).isFile()) return index
  return null
}

createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }
  const file = fileFor(request.url ?? '/') ?? join(root, 'index.html')
  const headers = { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }
  if (file.endsWith('mockServiceWorker.js')) headers['Cache-Control'] = 'no-cache'
  response.writeHead(200, headers)
  if (request.method === 'HEAD') response.end()
  else createReadStream(file).pipe(response)
}).listen(port, () => {
  console.log(`[serve-static] ${root} on http://localhost:${port} (SPA fallback to index.html)`)
})
