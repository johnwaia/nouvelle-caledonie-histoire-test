// Met à jour dans database/kanaky.sqlite les 33 communes de Nouvelle-Calédonie, avec position,
// province, aire coutumière, et un extrait de leur histoire tiré de Wikipédia (licence CC BY-SA 4.0,
// source citée dans chaque fiche).
//
//   node scripts/import-communes.mjs
//
// Les autres champs (histoire manuelle, image, sources…) sont conservés.
// « resume » et « histoire » sont rechargés : pour garder un texte retouché, remplir « Histoire manuelle » dans l'administration.
import { openDb, reader, saveCommune, transaction } from '../database/db.mjs'
import { readAll } from '../src/db/read.js'

const UA = { 'User-Agent': 'nc-histoire-communes/1.0' }

// [nom affiché, titre Wikipédia, province, aire coutumière]
const COMMUNES = [
  ['Bélep', 'Bélep', 'Nord', 'Hoot ma Whaap'],
  ['Boulouparis', 'Boulouparis', 'Sud', 'Xârâcùù'],
  ['Bourail', 'Bourail', 'Sud', 'Ajië-Arhö'],
  ['Canala', 'Canala', 'Nord', 'Xârâcùù'],
  ['Dumbéa', 'Dumbéa', 'Sud', 'Drubea-Kapumë'],
  ['Farino', 'Farino', 'Sud', 'Xârâcùù'],
  ['Hienghène', 'Hienghène', 'Nord', 'Hoot ma Whaap'],
  ['Houaïlou', 'Houaïlou', 'Nord', 'Ajië-Arhö'],
  ['Île des Pins', "L'Île-des-Pins", 'Sud', 'Drubea-Kapumë'],
  ['Kaala-Gomen', 'Kaala-Gomen', 'Nord', 'Hoot ma Whaap'],
  ['Koné', 'Koné (Nouvelle-Calédonie)', 'Nord', 'Paicî-Cèmuhî'],
  ['Kouaoua', 'Kouaoua', 'Nord', 'Xârâcùù'],
  ['Koumac', 'Koumac', 'Nord', 'Hoot ma Whaap'],
  ['La Foa', 'La Foa', 'Sud', 'Xârâcùù'],
  ['Lifou', 'Lifou', 'Îles Loyauté', 'Drehu'],
  ['Maré', 'Maré', 'Îles Loyauté', 'Nengone'],
  ['Moindou', 'Moindou', 'Sud', 'Ajië-Arhö'],
  ['Mont-Dore', 'Le Mont-Dore (Nouvelle-Calédonie)', 'Sud', 'Drubea-Kapumë'],
  ['Nouméa', 'Nouméa', 'Sud', 'Drubea-Kapumë'],
  ['Ouégoa', 'Ouégoa', 'Nord', 'Hoot ma Whaap'],
  ['Ouvéa', 'Ouvéa', 'Îles Loyauté', 'Iaai'],
  ['Païta', 'Païta', 'Sud', 'Drubea-Kapumë'],
  ['Poindimié', 'Poindimié', 'Nord', 'Paicî-Cèmuhî'],
  ['Ponérihouen', 'Ponérihouen', 'Nord', 'Paicî-Cèmuhî'],
  ['Pouébo', 'Pouébo', 'Nord', 'Hoot ma Whaap'],
  ['Pouembout', 'Pouembout', 'Nord', 'Paicî-Cèmuhî'],
  ['Poum', 'Poum (Nouvelle-Calédonie)', 'Nord', 'Hoot ma Whaap'],
  ['Poya', 'Poya (Nouvelle-Calédonie)', 'Nord', 'Ajië-Arhö'],
  ['Sarraméa', 'Sarraméa', 'Sud', 'Xârâcùù'],
  ['Thio', 'Thio', 'Sud', 'Xârâcùù'],
  ['Touho', 'Touho', 'Nord', 'Paicî-Cèmuhî'],
  ['Voh', 'Voh', 'Nord', 'Hoot ma Whaap'],
  ['Yaté', 'Yaté', 'Sud', 'Drubea-Kapumë'],
]

const plain = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const slug = (s) => plain(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function wiki(params) {
  const url = 'https://fr.wikipedia.org/w/api.php?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  for (let i = 0; i < 8; i++) {
    await sleep(1500 * (i + 1))
    const res = await fetch(url, { headers: UA })
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch {
      console.warn(`  nouvel essai (${res.status})`)
    }
  }
  throw new Error('Wikipédia ne répond pas')
}

// Coupe proprement un texte à ~max caractères, en fin de phrase.
function trim(text, max) {
  // Espaces de fin de ligne retirés ligne par ligne (pas d'expression régulière à retour arrière)
  const t = text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'))
  if (end > max * 0.5) return cut.slice(0, end + 1).trim()
  // Sinon : coupe au dernier espace pour ne pas couper un mot
  const space = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('\n'))
  return (space > 0 ? cut.slice(0, space) : cut).trim() + '…'
}

// Extrait la section « Histoire » (sous-sections comprises) du texte brut de l'article.
function histoireSection(extract) {
  // Découpage ligne par ligne plutôt qu'une grande expression régulière (temps d'exécution garanti)
  const lines = extract.split('\n')
  const start = lines.findIndex((l) => ['== Histoire ==', '==Histoire=='].includes(l.trim()))
  if (start === -1) return ''
  const out = []
  for (const line of lines.slice(start + 1)) {
    const l = line.trim()
    if (l.startsWith('== ') && !l.startsWith('===')) break // section suivante
    if (l.startsWith('===') && l.endsWith('===')) {
      out.push(`\n${l.replaceAll('=', '').trim()}.`) // sous-titre (tous niveaux) → « Titre. »
    } else {
      out.push(l.replaceAll('\t', ' '))
    }
  }
  return out.join('\n').trim()
}

const db = openDb()
const old = readAll(reader(db))
const previous = new Map(old.communes.map((c) => [c.id, c]))

const out = []
for (const [nom, titre, province, aire] of COMMUNES) {
  const id = slug(nom)
  process.stdout.write(`${nom}… `)
  const r = await wiki({
    action: 'query',
    titles: titre,
    redirects: '1',
    prop: 'coordinates|extracts|info|pageprops',
    explaintext: '1',
    exsectionformat: 'wiki',
    inprop: 'url',
  })
  const page = r.query?.pages?.[0]
  const coords = page?.coordinates?.[0]
  const extract = page?.extract || ''
  const intro = trim(extract.split(/\n== /)[0], 450)
  const histoire = trim(histoireSection(extract), 1400)
  const prev = previous.get(id) || {}
  out.push({
    ...prev,
    id,
    nom,
    province,
    aire,
    coords: coords ? [+coords.lat.toFixed(5), +coords.lon.toFixed(5)] : prev.coords,
    resume: intro || prev.resume || '',
    histoire: histoire || prev.histoire || '',
    wikipedia: page?.fullurl || prev.wikipedia,
  })
  console.log(`${coords ? 'position ✓' : 'position ✗'} · histoire ${histoire ? histoire.length + ' car.' : '✗'}`)
}

transaction(db, () => out.forEach((c) => saveCommune(db, c)))
db.close()
console.log(`${out.length} communes écrites.`)
