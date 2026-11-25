/*
 * Administration : npm run admin → http://127.0.0.1:5180
 * Fonctionne uniquement sur cet ordinateur et modifie directement database/kanaky.sqlite.
 * Pour publier : committer database/kanaky.sqlite puis pousser sur main.
 */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { openDb } from '../database/db.mjs'
import { handle, ApiError, MAX_UPLOAD } from '../src/db/api.js'

const PORT = Number(process.env.PORT) || 5180
const HOSTS = [`127.0.0.1:${PORT}`, `localhost:${PORT}`]
const db = openDb()

const STATIC = {
  '/': ['index.html', 'text/html'],
  '/local.js': ['local.js', 'text/javascript'],
  '/ui.js': ['ui.js', 'text/javascript'],
  '/admin.css': ['admin.css', 'text/css'],
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size <= MAX_UPLOAD) chunks.push(c)
    })
    req.on('end', () => (size > MAX_UPLOAD ? reject(new ApiError(413, 'Fichier trop lourd (8 Mo au maximum)')) : resolve(Buffer.concat(chunks))))
    req.on('error', reject)
  })
}
const readJson = async (req) => {
  try {
    return JSON.parse(await readBody(req))
  } catch (e) {
    throw e.status ? e : new ApiError(400, 'Requête illisible')
  }
}
async function api(req, url) {
  const path = url.pathname.slice('/api/'.length) + url.search
  const isUpload = req.method === 'POST' && path.startsWith('images/')
  const body = isUpload ? await readBody(req) : ['POST', 'PUT'].includes(req.method) ? await readJson(req) : undefined
  return handle(db, req.method, path, body)
}

function sendImage(res, id) {
  const row = db.prepare('SELECT mime, data FROM image_data WHERE image_id = ?').get(id)
  if (!row) throw new ApiError(404, 'Image introuvable')
  // Un SVG ouvert directement ne doit pas pouvoir exécuter de script.
  res.writeHead(200, { 'Content-Type': row.mime, 'Cache-Control': 'no-cache', 'Content-Security-Policy': "script-src 'none'" })
  res.end(Buffer.from(row.data))
}

createServer(async (req, res) => {
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
  }
  try {
    // Seule la page d'administration elle-même peut appeler l'API (pas un autre site ouvert dans le navigateur).
    if (!HOSTS.includes(req.headers.host)) throw new ApiError(403, 'Accès refusé')
    const url = new URL(req.url, `http://${req.headers.host}`)
    if (req.method !== 'GET' && req.headers.origin !== url.origin) throw new ApiError(403, 'Accès refusé')
    if (url.pathname.startsWith('/api/')) return json(200, await api(req, url))
    if (url.pathname.startsWith('/images/')) return sendImage(res, decodeURIComponent(url.pathname.slice(1)))
    const file = Object.hasOwn(STATIC, url.pathname) && STATIC[url.pathname]
    if (!file) throw new ApiError(404, 'Page introuvable')
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-cache', 'X-Frame-Options': 'DENY' })
    res.end(readFileSync(new URL(file[0], import.meta.url)))
  } catch (e) {
    json(e.status || 400, { error: e.message })
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Administration : http://127.0.0.1:${PORT}  (Ctrl+C pour arrêter)`))
