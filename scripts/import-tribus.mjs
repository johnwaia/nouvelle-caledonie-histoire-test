// Met à jour les tribus de database/kanaky.sqlite à partir de la liste officielle des tribus
// (Gouvernement de la Nouvelle-Calédonie / DITTT — couche « Localités et zones bâties », type TRIBU),
// en conservant les fiches déjà rédigées (champs origines, evenements, sources…).
//
//   node scripts/import-tribus.mjs

import { openDb, reader, saveTribu, transaction } from '../database/db.mjs'
import { readAll } from '../src/db/read.js'

const SERVICE =
  'https://services1.arcgis.com/TZcrgU6CIbqWt9Qv/arcgis/rest/services/LOCALITES_ET_ZONES_BATIES/FeatureServer/0/query'

// Aire coutumière par commune
const AIRES = {
  'Hoot ma Whaap': ['Belep', 'Hienghene', 'Kaala-Gomen', 'Koumac', 'Ouegoa', 'Pouebo', 'Poum', 'Voh'],
  'Paicî-Cèmuhî': ['Kone', 'Poindimie', 'Ponerihouen', 'Pouembout', 'Touho'],
  'Ajië-Arhö': ['Bourail', 'Houailou', 'Moindou', 'Poya'],
  'Xârâcùù': ['Boulouparis', 'Canala', 'Farino', 'Kouaoua', 'La Foa', 'Sarramea', 'Thio'],
  'Drubea-Kapumë': ['Dumbea', 'Ile des Pins', 'Mont-Dore', 'Noumea', 'Paita', 'Yate'],
  Nengone: ['Mare'],
  Drehu: ['Lifou'],
  Iaai: ['Ouvea'],
}
const plain = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const slug = (s) => plain(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const AIRE_OF = Object.fromEntries(Object.entries(AIRES).flatMap(([aire, cs]) => cs.map((c) => [plain(c).toLowerCase(), aire])))
const COMMUNE_LABEL = { Houailou: 'Houaïlou', 'Ile des Pins': 'Île des Pins' }

// Fiches détaillées existantes, rattachées au point officiel correspondant
const MATCH = {
  tiendanite: ['Tiendanite', 'Hienghène'],
  nakety: ['Nakéty', 'Canala'],
  'petit-couli': ['Petit Couli', 'Sarraméa'],
  'saint-louis': ['St Louis', 'Mont-Dore'],
  vao: ['Vao', 'Ile des Pins'],
  nece: ['Netché', 'Maré'],
  gossanah: ['Gossanah', 'Ouvéa'],
  hwadrilla: ['Hwaadrila', 'Ouvéa'],
}

const db = openDb()
const old = readAll(reader(db))
const documented = new Map(
  (old.tribus || [])
    .filter((t) => t.origines || t.evenements?.length || t.ajoutManuel)
    .map((t) => [t.id, t]),
)

const url = SERVICE + '?' + new URLSearchParams({ where: "type='TRIBU'", outFields: '*', outSR: '4326', resultRecordCount: '2000', f: 'json' })
const res = await fetch(url)
if (!res.ok) throw new Error(`DITTT : HTTP ${res.status}`)
const features = (await res.json()).features || []
console.log(`${features.length} tribus officielles téléchargées`)

const usedIds = new Set()
const list = []
for (const f of features) {
  const a = f.attributes
  const nom = plain(a.nom_offici) ? String(a.nom_offici).replace(/\s+/g, ' ').trim() : String(a.nom_isee || '').trim()
  if (!nom || !f.geometry) continue
  const communeRaw = String(a.commune || '').trim()
  const commune = COMMUNE_LABEL[plain(communeRaw)] || communeRaw
  const docId = Object.keys(MATCH).find((id) => plain(MATCH[id][0]) === plain(nom) && plain(MATCH[id][1]) === plain(communeRaw))
  let id = docId || slug(`${nom}-${commune}`)
  let n = 2
  while (usedIds.has(id)) id = slug(`${nom}-${commune}-${n++}`) // identifiant unique en cas d'homonymes
  usedIds.add(id)
  const base = {
    id,
    nom,
    nomLocal: String(a.nom_local || '').trim() || undefined,
    commune,
    coords: [+f.geometry.y.toFixed(5), +f.geometry.x.toFixed(5)],
    aire: AIRE_OF[plain(communeRaw).toLowerCase()] || '',
  }
  const doc = documented.get(id)
  // Les champs rédigés à la main sont prioritaires (sauf la position officielle).
  const entry = doc ? { ...base, ...doc, nom: doc.nom, coords: base.coords } : base
  list.push(entry)
  documented.delete(id)
}
// Fiches rédigées sans point officiel correspondant (ex. Hnathalo) : conservées telles quelles.
for (const doc of documented.values()) list.push(doc)

transaction(db, () => {
  const kept = new Set(list.map((t) => t.id))
  for (const t of old.tribus) if (!kept.has(t.id)) db.prepare('DELETE FROM tribus WHERE id = ?').run(t.id)
  for (const t of list) saveTribu(db, t)
})
db.close()
console.log(`${list.length} tribus écrites (${list.filter((t) => t.origines).length} avec fiche détaillée)`)
