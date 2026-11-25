// Publie la base avec le site : data/kanaky.sqlite (sans les images) et chaque image en fichier séparé,
// pour que le navigateur ne télécharge que celles qu'il affiche.
import { DB_FILE, openDb, publicDatabase } from './db.mjs'

const unix = (p) => p.replaceAll('\\', '/')

export default function kanakyDatabase() {
  return {
    name: 'kanaky-database',

    // Serveur de développement : lecture directe dans la base, page rechargée si elle change.
    configureServer(server) {
      server.watcher.add(DB_FILE)
      server.watcher.on('change', (f) => {
        if (unix(f) === unix(DB_FILE)) server.ws.send({ type: 'full-reload' })
      })
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url, 'http://localhost').pathname.slice(1)
        if (path === 'data/kanaky.sqlite') {
          res.setHeader('Cache-Control', 'no-cache')
          res.end(publicDatabase())
          return
        }
        if (!path.startsWith('images/')) return next()
        const db = openDb(DB_FILE, { readOnly: true })
        const row = db.prepare('SELECT mime, data FROM image_data WHERE image_id = ?').get(decodeURIComponent(path))
        db.close()
        if (!row) return next()
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Content-Type', row.mime)
        res.end(Buffer.from(row.data))
      })
    },

    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'data/kanaky.sqlite', source: publicDatabase() })
      const db = openDb(DB_FILE, { readOnly: true })
      for (const { image_id, data } of db.prepare('SELECT image_id, data FROM image_data').all()) {
        this.emitFile({ type: 'asset', fileName: image_id, source: data })
      }
      db.close()
    },
  }
}
