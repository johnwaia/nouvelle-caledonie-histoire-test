/*
 * Lecture de la base : lignes SQL → objets utilisés par le site.
 * Partagé par le site (sql.js), l'administration et les scripts (node:sqlite) :
 * « all(sql) » exécute une requête et renvoie un tableau d'objets.
 */

// Retire les champs vides (NULL, texte vide, liste vide).
const isEmpty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => !isEmpty(v)))

// Lignes d'une table liée (sources, vidéos…), regroupées par propriétaire.
function groupBy(rows, key) {
  const map = new Map()
  for (const { [key]: owner, position, ...row } of rows) {
    if (!map.has(owner)) map.set(owner, [])
    map.get(owner).push(compact(row))
  }
  return (id) => map.get(id) || []
}
const coordsOf = (r) => (r.lat === null ? null : [r.lat, r.lon])
const imageOf = (r) =>
  r.image_id ? compact({ url: r.image_id, alt: r.image_alt, credit: r.image_credit, source: r.image_source }) : null
const WITH_IMAGE = 'images.credit AS image_credit, images.source AS image_source'

function readCategories(all) {
  const rows = all('SELECT * FROM categories ORDER BY position')
  return Object.fromEntries(rows.map((c) => [c.id, { label: c.label, color: c.color }]))
}

function readPeriods(all) {
  return all('SELECT * FROM periods ORDER BY position').map((p) => ({
    id: p.id,
    name: p.name,
    from: p.from_year,
    to: p.to_year,
    color: p.color,
  }))
}

function readEvents(all) {
  const sources = groupBy(all('SELECT * FROM event_sources ORDER BY event_id, position'), 'event_id')
  const videos = groupBy(all('SELECT * FROM event_videos ORDER BY event_id, position'), 'event_id')
  const rows = all(
    `SELECT events.*, ${WITH_IMAGE} FROM events LEFT JOIN images ON images.id = events.image_id ORDER BY events.position`,
  )
  return rows.map((r) => ({
    ...compact({
      id: r.id,
      title: r.title,
      date: r.date,
      endDate: r.end_date,
      approx: r.approx ? true : null,
      dateLabel: r.date_label,
      place: r.place,
      category: r.category_id,
      description: r.description,
      logo: r.logo_id,
      image: imageOf(r),
      auSud: r.au_sud ? true : null,
      videos: videos(r.id),
    }),
    coords: coordsOf(r),
    sources: sources(r.id),
  }))
}

function readTribus(all) {
  const sources = groupBy(all('SELECT * FROM tribu_sources ORDER BY tribu_id, position'), 'tribu_id')
  const evenements = groupBy(all('SELECT * FROM tribu_evenements ORDER BY tribu_id, position'), 'tribu_id')
  const rows = all(
    `SELECT tribus.*, communes.nom AS commune, aires.nom AS aire FROM tribus
     JOIN communes ON communes.id = tribus.commune_id
     JOIN aires ON aires.id = tribus.aire_id
     ORDER BY communes.nom, tribus.nom`,
  )
  return rows.map((r) =>
    compact({
      id: r.id,
      nom: r.nom,
      nomLocal: r.nom_local,
      commune: r.commune,
      ile: r.ile,
      coords: coordsOf(r),
      aire: r.aire,
      origines: r.origines,
      evenements: evenements(r.id),
      sources: sources(r.id),
      ajoutManuel: r.ajout_manuel ? true : null,
    }),
  )
}

function readCommunes(all) {
  const sources = groupBy(all('SELECT * FROM commune_sources ORDER BY commune_id, position'), 'commune_id')
  const rows = all(
    `SELECT communes.*, provinces.cle AS province, aires.nom AS aire, ${WITH_IMAGE} FROM communes
     JOIN provinces ON provinces.id = communes.province_id
     JOIN aires ON aires.id = communes.aire_id
     LEFT JOIN images ON images.id = communes.image_id
     ORDER BY communes.id`,
  )
  return rows.map((r) =>
    compact({
      id: r.id,
      nom: r.nom,
      province: r.province,
      aire: r.aire,
      coords: coordsOf(r),
      resume: r.resume,
      histoire: r.histoire,
      histoireManuelle: r.histoire_manuelle,
      wikipedia: r.wikipedia,
      image: imageOf(r),
      sources: sources(r.id),
    }),
  )
}

// Zones de la carte (GeoJSON)
const collection = (rows, propsOf) => ({
  type: 'FeatureCollection',
  features: rows.map((r) => ({ type: 'Feature', properties: compact(propsOf(r)), geometry: JSON.parse(r.geometry) })),
})
const readAires = (all) =>
  collection(all('SELECT * FROM aires ORDER BY position'), (r) => ({
    id: r.id,
    nom: r.nom,
    couleur: r.couleur,
    description: r.description,
  }))
const readProvinces = (all) =>
  collection(all('SELECT * FROM provinces ORDER BY position'), (r) => ({
    id: r.id,
    nom: r.nom,
    cle: r.cle,
    couleur: r.couleur,
    chefLieu: r.chef_lieu,
    description: r.description,
  }))

export const readAll = (all) => ({
  categories: readCategories(all),
  periods: readPeriods(all),
  events: readEvents(all),
  tribus: readTribus(all),
  communes: readCommunes(all),
  aires: readAires(all),
  provinces: readProvinces(all),
})
