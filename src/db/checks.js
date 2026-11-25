// Règles de validation des données, communes à `npm run check-data` et à l'administration.
const DATE_RE = /^-?\d{1,4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/
const URL_RE = /^https?:\/\//
const ID_RE = /^[a-z0-9-]+$/
const COLOR_RE = /^#[0-9a-f]{6}$/i

const toNum = (d) => {
  const [y, m = '1', j = '1'] = String(d).replace(/^-/, 'N').split('-')
  return (y.startsWith('N') ? -+y.slice(1) : +y) + (+m - 1) / 12 + (+j - 1) / 365
}
const isNum = (n) => typeof n === 'number' && Number.isFinite(n)
const isLatLon = (c) => Array.isArray(c) && c.length === 2 && c.every(isNum)
const outsideArchipelago = ([lat, lon]) => lat < -23.5 || lat > -18.5 || lon < 158 || lon > 169

// Accumule erreurs (bloquantes) et avertissements.
function report() {
  const errors = []
  const warnings = []
  return { errors, warnings, error: (m) => errors.push(m), warn: (m) => warnings.push(m) }
}

function checkId(o, r) {
  if (!ID_RE.test(o.id || '')) r.error('identifiant obligatoire : uniquement a-z, 0-9 et tirets')
}
function checkRequired(o, fields, r) {
  for (const f of fields) if (typeof o[f] !== 'string' || !o[f].trim()) r.error(`champ « ${f} » obligatoire`)
}
function checkCoords(coords, r) {
  if (!isLatLon(coords)) r.error('coordonnées : latitude et longitude attendues')
  else if (outsideArchipelago(coords)) r.warn("coordonnées hors de l'archipel (inversion latitude/longitude ?)")
}
function checkLinks(list, name, { labelRequired = true, urlRequired = false } = {}, r) {
  for (const l of list || []) {
    if (labelRequired && !l.label) r.error(`${name} : libellé obligatoire`)
    if ((urlRequired || l.url) && !URL_RE.test(l.url || '')) r.error(`${name} : lien invalide « ${l.url || ''} »`)
  }
}
function checkColor(color, r) {
  if (!COLOR_RE.test(color || '')) r.error('couleur attendue au format #rrggbb')
}

export function checkEvent(e) {
  const r = report()
  checkId(e, r)
  checkRequired(e, ['title', 'date', 'place', 'category', 'description'], r)
  if (e.date && !DATE_RE.test(e.date)) r.error(`date « ${e.date} » invalide (AAAA, AAAA-MM ou AAAA-MM-JJ)`)
  if (e.endDate && !DATE_RE.test(e.endDate)) r.error(`date de fin « ${e.endDate} » invalide`)
  else if (e.date && e.endDate && toNum(e.endDate) < toNum(e.date)) r.error('date de fin antérieure à la date')
  if (e.coords !== null && e.coords !== undefined) checkCoords(e.coords, r)
  if (!e.sources?.length) r.warn('aucune source')
  checkLinks(e.sources, 'source', {}, r)
  checkLinks(e.videos, 'vidéo', { labelRequired: false, urlRequired: true }, r)
  if (e.image && !e.image.credit) r.warn('image sans crédit')
  return r
}
export function checkTribu(t) {
  const r = report()
  checkId(t, r)
  checkRequired(t, ['nom', 'commune', 'aire'], r)
  checkCoords(t.coords, r)
  checkLinks(t.sources, 'source', {}, r)
  for (const e of t.evenements || []) checkRequired(e, ['date', 'texte'], r)
  return r
}
export function checkCommune(c) {
  const r = report()
  checkId(c, r)
  checkRequired(c, ['nom', 'province', 'aire'], r)
  checkCoords(c.coords, r)
  checkLinks(c.sources, 'source', {}, r)
  if (c.wikipedia && !URL_RE.test(c.wikipedia)) r.error('lien Wikipédia invalide')
  return r
}
export function checkZone(z) {
  const r = report()
  checkId(z, r)
  checkRequired(z, ['nom'], r)
  checkColor(z.couleur, r)
  return r
}
export function checkCategory(c) {
  const r = report()
  checkId(c, r)
  checkRequired(c, ['label'], r)
  checkColor(c.color, r)
  return r
}
export function checkPeriod(p) {
  const r = report()
  checkId(p, r)
  checkRequired(p, ['name'], r)
  checkColor(p.color, r)
  if (!isNum(p.from)) r.error('année de début obligatoire')
  if (isNum(p.to) && p.to <= p.from) r.error('année de fin antérieure au début')
  return r
}
