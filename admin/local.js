// Version locale : les actions sont exécutées par admin/server.mjs.
import { attempt, startAdmin } from './ui.js'

const versions = new Map() // une image remplacée doit être rechargée
attempt(() =>
  startAdmin({
    imageUrl: (id) => '/' + id.split('/').map(encodeURIComponent).join('/') + (versions.has(id) ? '?v=' + versions.get(id) : ''),
    async call(method, path, body) {
      const raw = body instanceof Blob
      const res = await fetch('/api/' + path, {
        method,
        headers: body && !raw ? { 'Content-Type': 'application/json' } : {},
        body: raw ? body : body && JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (raw) versions.set(decodeURIComponent(path.split('?')[0].split('/')[1]), Date.now())
      return data
    },
  }),
)
