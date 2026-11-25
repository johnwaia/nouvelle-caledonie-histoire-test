// Vérifie database/kanaky.sqlite avant publication : `npm run check-data`
import { openDb, reader, DB_FILE } from '../database/db.mjs'
import { checkCategory, checkCommune, checkEvent, checkPeriod, checkTribu, checkZone } from '../src/db/checks.js'
import { readAll } from '../src/db/read.js'

const db = openDb(DB_FILE, { readOnly: true })
const errors = []
const warnings = []

for (const row of db.prepare('PRAGMA integrity_check').all()) if (row.integrity_check !== 'ok') errors.push(`base : ${row.integrity_check}`)
for (const row of db.prepare('PRAGMA foreign_key_check').all()) errors.push(`base : lien cassé dans ${row.table} vers ${row.parent}`)
for (const { id } of db.prepare("SELECT id FROM images WHERE id NOT LIKE 'http%' AND id NOT IN (SELECT image_id FROM image_data)").all()) {
  errors.push(`image ${id} : contenu absent de la base`)
}

const data = readAll(reader(db))
const total = (table) => db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n
const images = total('image_data')
const tribuTotal = total('tribus')
db.close()

function check(name, list, rule) {
  for (const item of list) {
    const r = rule(item)
    for (const m of r.errors) errors.push(`${name} ${item.id} : ${m}`)
    for (const m of r.warnings) warnings.push(`${name} ${item.id} : ${m}`)
  }
}
const categories = Object.entries(data.categories).map(([id, c]) => ({ id, ...c }))
check('catégorie', categories, checkCategory)
check('période', data.periods, checkPeriod)
check('événement', data.events, checkEvent)
check('tribu', data.tribus, checkTribu)
check('commune', data.communes, checkCommune)
check('aire', data.aires.features.map((f) => f.properties), checkZone)
check('province', data.provinces.features.map((f) => f.properties), checkZone)
if (!data.events.length) errors.push('aucun événement')
if (data.tribus.length !== tribuTotal) errors.push('des tribus ne sont rattachées à aucune commune ou aire')

warnings.forEach((w) => console.warn(`⚠ ${w}`))
if (errors.length) {
  errors.forEach((e) => console.error(`✖ ${e}`))
  console.error(`\n${errors.length} erreur(s) — à corriger avant de publier (npm run admin).`)
  process.exit(1)
}
console.log(
  `✔ ${data.events.length} événements, ${categories.length} catégories, ${data.periods.length} périodes, ` +
    `${data.tribus.length} tribus, ${data.communes.length} communes, ${images} images en base.`,
)
