// Accès à database/kanaky.sqlite depuis Node : administration, scripts et publication.
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export * from '../src/db/write.js'

export const DB_FILE = process.env.KANAKY_DB || fileURLToPath(new URL('./kanaky.sqlite', import.meta.url))
export const SCHEMA_FILE = fileURLToPath(new URL('./schema.sql', import.meta.url))

export function openDb(file = DB_FILE, options = {}) {
  const db = new DatabaseSync(file, options)
  db.exec('PRAGMA foreign_keys = ON')
  return db
}

/* ---------- Publication ---------- */
// Copie de la base sans le contenu des images : c'est elle que le navigateur télécharge.
export function publicDatabase() {
  const dir = mkdtempSync(join(tmpdir(), 'kanaky-'))
  try {
    const copy = join(dir, 'public.sqlite')
    const db = openDb(DB_FILE, { readOnly: true })
    db.prepare('VACUUM INTO ?').run(copy)
    db.close()
    const pub = openDb(copy)
    pub.exec('DELETE FROM image_data')
    pub.exec('VACUUM')
    pub.close()
    return readFileSync(copy)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
