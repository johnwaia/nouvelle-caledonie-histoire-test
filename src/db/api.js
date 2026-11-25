/*
 * Actions de l'administration, communes à la version locale (admin/server.mjs) et en ligne (admin/online.js) :
 *   GET state · POST|PUT|DELETE <type>/<id> · POST images/<id>[?replace=1] (octets de l'image)
 */
import * as store from './write.js'
import * as checks from './checks.js'
import { readAll } from './read.js'

export const MAX_UPLOAD = 8 * 1024 * 1024

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const TYPES = {
  events: { save: store.saveEvent, check: checks.checkEvent },
  tribus: { save: store.saveTribu, check: checks.checkTribu },
  communes: { save: store.saveCommune, check: checks.checkCommune },
  aires: { save: store.saveAire, check: checks.checkZone, fixed: true },
  provinces: { save: store.saveProvince, check: checks.checkZone, fixed: true },
  categories: { save: store.saveCategory, check: checks.checkCategory },
  periods: { save: store.savePeriod, check: checks.checkPeriod },
}

function state(db) {
  const data = readAll(store.reader(db))
  return {
    events: data.events,
    tribus: data.tribus,
    communes: data.communes,
    aires: data.aires.features.map((f) => f.properties),
    provinces: data.provinces.features.map((f) => f.properties),
    categories: Object.entries(data.categories).map(([id, c]) => ({ id, ...c })),
    periods: data.periods,
    images: db
      .prepare(
        `SELECT images.*, length(image_data.data) AS size,
          (SELECT count(*) FROM events WHERE logo_id = images.id OR image_id = images.id)
          + (SELECT count(*) FROM communes WHERE image_id = images.id) AS uses
         FROM images LEFT JOIN image_data ON image_id = images.id ORDER BY images.id`,
      )
      .all(),
  }
}

const exists = (db, table, id) => !!db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id)

function saveItem(db, type, item, creating) {
  const { save, check, fixed } = TYPES[type]
  const { errors, warnings } = check(item || {})
  if (errors.length) throw new ApiError(422, errors.join('\n'))
  if (creating && fixed) throw new ApiError(400, 'Impossible de créer une zone ici : son contour est nécessaire')
  if (creating && exists(db, type, item.id)) throw new ApiError(409, `L'identifiant « ${item.id} » existe déjà`)
  if (!creating && !exists(db, type, item.id)) throw new ApiError(404, 'Élément introuvable')
  store.transaction(db, () => save(db, item))
  return { warnings }
}

function removeItem(db, type, id) {
  if (TYPES[type]?.fixed) throw new ApiError(400, 'Suppression impossible')
  if (!exists(db, type, id)) throw new ApiError(404, 'Élément introuvable')
  db.prepare(`DELETE FROM ${type} WHERE id = ?`).run(id)
  return {}
}

function addImage(db, id, data, replace) {
  if (!data?.length) throw new ApiError(400, 'Fichier vide')
  if (data.length > MAX_UPLOAD) throw new ApiError(413, 'Fichier trop lourd (8 Mo au maximum)')
  if (!replace && exists(db, 'images', id)) throw new ApiError(409, `L'image « ${id} » existe déjà`)
  store.transaction(db, () => store.saveImageData(db, id, data))
  return {}
}

function dispatch(db, method, path, body) {
  const [address, query] = path.split('?')
  const [type, rawId] = address.split('/')
  const id = rawId && decodeURIComponent(rawId)
  if (method === 'GET' && type === 'state') return state(db)
  if (type === 'images') {
    if (method === 'POST') return addImage(db, id, body, query === 'replace=1')
    if (method === 'DELETE') return removeItem(db, 'images', id)
    if (method === 'PUT') {
      store.saveImage(db, body)
      return {}
    }
  } else if (Object.hasOwn(TYPES, type)) {
    if (method === 'POST') return saveItem(db, type, body, true)
    if (method === 'PUT') return saveItem(db, type, body, false)
    if (method === 'DELETE') return removeItem(db, type, id)
  }
  throw new ApiError(404, 'Adresse inconnue')
}

// Messages SQLite → messages compréhensibles
export function handle(db, method, path, body) {
  try {
    return dispatch(db, method, path, body)
  } catch (e) {
    if (/FOREIGN KEY/.test(e.message)) throw new ApiError(409, "Élément encore utilisé, ou lien vers un élément qui n'existe pas")
    if (/UNIQUE/.test(e.message)) throw new ApiError(409, 'Ce nom est déjà utilisé')
    throw e
  }
}
