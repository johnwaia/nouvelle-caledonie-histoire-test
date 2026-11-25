/*
 * Écriture dans la base, commune à Node (node:sqlite) et au navigateur (voir src/db/browser.js) :
 * « db » offre exec(sql) et prepare(sql).run/get/all(...).
 */
export const reader = (db) => (sql) => db.prepare(sql).all().map((r) => ({ ...r }))

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

const orNull = (v) => (v === undefined || v === '' ? null : v)

// Ajoute la ligne, ou met à jour celle qui porte le même id.
export function upsert(db, table, row) {
  const cols = Object.keys(row)
  const set = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`)
  db.prepare(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT (id) DO UPDATE SET ${set.join(', ')}`,
  ).run(...cols.map((c) => orNull(row[c])))
}

// Remplace toutes les lignes liées à un élément (sources, vidéos…).
function replaceChildren(db, table, owner, ownerId, cols, rows = []) {
  db.prepare(`DELETE FROM ${table} WHERE ${owner} = ?`).run(ownerId)
  const insert = db.prepare(
    `INSERT INTO ${table} (${owner}, position, ${cols.join(', ')}) VALUES (?, ?, ${cols.map(() => '?').join(', ')})`,
  )
  rows.forEach((row, i) => insert.run(ownerId, i, ...cols.map((c) => orNull(row[c]))))
}

// Garde la position d'un élément existant ; un nouvel élément va à la fin.
const positionOf = (db, table, id) =>
  db.prepare(`SELECT position FROM ${table} WHERE id = ?`).get(id)?.position ??
  db.prepare(`SELECT coalesce(max(position), -1) + 1 AS n FROM ${table}`).get().n

function idBy(db, table, col, value) {
  const row = db.prepare(`SELECT id FROM ${table} WHERE ${col} = ?`).get(value ?? null)
  if (!row) throw new Error(`« ${value ?? ''} » introuvable (${table})`)
  return row.id
}

/* ---------- Images ---------- */
const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}
const isLink = (id) => /^https?:\/\//.test(id)
const IMAGE_PATH = /^images\/(evenements|logos|communes)\/[^/\\]+\.(jpe?g|png|webp|avif|gif|svg)$/i

export function saveImage(db, { id, credit, source }) {
  if (!isLink(id) && !db.prepare('SELECT 1 FROM images WHERE id = ?').get(id)) throw new Error(`Image « ${id} » absente de la base`)
  upsert(db, 'images', { id, credit, source })
}
export function saveImageData(db, id, data) {
  if (!IMAGE_PATH.test(id)) throw new Error(`Chemin d'image invalide : ${id}`)
  db.prepare('INSERT INTO images (id) VALUES (?) ON CONFLICT DO NOTHING').run(id)
  db.prepare(
    'INSERT INTO image_data VALUES (?, ?, ?) ON CONFLICT (image_id) DO UPDATE SET mime = excluded.mime, data = excluded.data',
  ).run(id, MIME[id.split('.').pop().toLowerCase()], data)
}
// Image choisie dans une fiche : son crédit et sa source sont enregistrés avec elle.
function useImage(db, image) {
  if (!image?.url) return null
  saveImage(db, { id: image.url, credit: image.credit, source: image.source })
  return image.url
}

/* ---------- Fiches (mêmes objets que src/db/read.js) ---------- */
export function saveEvent(db, e) {
  upsert(db, 'events', {
    id: e.id,
    title: e.title,
    date: e.date,
    end_date: e.endDate,
    approx: e.approx ? 1 : 0,
    date_label: e.dateLabel,
    place: e.place,
    lat: e.coords?.[0],
    lon: e.coords?.[1],
    category_id: e.category,
    description: e.description,
    logo_id: e.logo,
    image_id: useImage(db, e.image),
    image_alt: e.image?.alt,
    au_sud: e.auSud ? 1 : 0,
    position: positionOf(db, 'events', e.id),
  })
  replaceChildren(db, 'event_sources', 'event_id', e.id, ['label', 'url'], e.sources)
  replaceChildren(db, 'event_videos', 'event_id', e.id, ['label', 'url'], e.videos)
}

export function saveTribu(db, t) {
  upsert(db, 'tribus', {
    id: t.id,
    nom: t.nom,
    nom_local: t.nomLocal,
    commune_id: idBy(db, 'communes', 'nom', t.commune),
    aire_id: idBy(db, 'aires', 'nom', t.aire),
    ile: t.ile,
    lat: t.coords?.[0],
    lon: t.coords?.[1],
    origines: t.origines,
    ajout_manuel: t.ajoutManuel ? 1 : 0,
  })
  replaceChildren(db, 'tribu_sources', 'tribu_id', t.id, ['label', 'url'], t.sources)
  replaceChildren(db, 'tribu_evenements', 'tribu_id', t.id, ['date', 'texte'], t.evenements)
}

export function saveCommune(db, c) {
  upsert(db, 'communes', {
    id: c.id,
    nom: c.nom,
    province_id: idBy(db, 'provinces', 'cle', c.province),
    aire_id: idBy(db, 'aires', 'nom', c.aire),
    lat: c.coords?.[0],
    lon: c.coords?.[1],
    resume: c.resume,
    histoire: c.histoire,
    histoire_manuelle: c.histoireManuelle,
    wikipedia: c.wikipedia,
    image_id: useImage(db, c.image),
    image_alt: c.image?.alt,
  })
  replaceChildren(db, 'commune_sources', 'commune_id', c.id, ['label', 'url'], c.sources)
}

// Aires et provinces : le contour existant est conservé s'il n'est pas fourni.
function saveZone(db, table, z, row) {
  const geometry = z.geometry ? JSON.stringify(z.geometry) : db.prepare(`SELECT geometry FROM ${table} WHERE id = ?`).get(z.id)?.geometry
  upsert(db, table, { id: z.id, nom: z.nom, couleur: z.couleur, description: z.description, ...row, geometry, position: positionOf(db, table, z.id) })
}
export const saveAire = (db, a) => saveZone(db, 'aires', a, {})
export const saveProvince = (db, p) => saveZone(db, 'provinces', p, { cle: p.cle, chef_lieu: p.chefLieu })

export const saveCategory = (db, c) =>
  upsert(db, 'categories', { id: c.id, label: c.label, color: c.color, position: positionOf(db, 'categories', c.id) })
export const savePeriod = (db, p) =>
  upsert(db, 'periods', {
    id: p.id,
    name: p.name,
    from_year: p.from,
    to_year: p.to,
    color: p.color,
    position: positionOf(db, 'periods', p.id),
  })
