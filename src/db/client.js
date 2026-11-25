// Ouvre dans le navigateur la base publiée avec le site (textes et liens ; les images sont des fichiers à part).
import { openBrowserDb } from './browser'
import { readAll } from './read'
import { reader } from './write'

export async function loadDatabase() {
  const buffer = fetch(import.meta.env.BASE_URL + 'data/kanaky.sqlite', { cache: 'no-cache' }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.arrayBuffer()
  })
  const db = await openBrowserDb(buffer)
  try {
    return readAll(reader(db))
  } finally {
    db.close()
  }
}
