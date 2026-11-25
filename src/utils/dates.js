// Formats acceptés pour "date" / "endDate" : "AAAA", "AAAA-MM", "AAAA-MM-JJ", années négatives = av. J.-C. ("-1100")
const RE = /^(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?$/
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export function parseDate(str) {
  if (str === undefined || str === null) return null
  const m = RE.exec(String(str).trim())
  if (!m) return null
  return { y: +m[1], m: m[2] ? +m[2] : null, d: m[3] ? +m[3] : null }
}

/** Convertit une date en année décimale (1878-07-01 → 1878.5) */
export function toDecimal(p) {
  if (!p) return NaN
  let t = p.y
  if (p.m) t += (p.m - 1) / 12
  if (p.d) t += (p.d - 1) / 365
  return t
}

function formatParts(p, approx) {
  if (!p) return ''
  const prefix = approx ? 'vers ' : ''
  if (p.y < 0) return `${prefix}${-p.y} av. J.-C.`
  let s = ''
  if (p.d) s += (p.d === 1 ? '1er' : p.d) + ' '
  if (p.m) s += MONTHS[p.m - 1] + ' '
  return prefix + s + p.y
}

export function formatEventDate(ev) {
  if (ev.dateLabel) return ev.dateLabel
  const start = formatParts(parseDate(ev.date), ev.approx)
  if (!ev.endDate) return start
  return `${start} – ${formatParts(parseDate(ev.endDate))}`
}

export function yearLabel(y) {
  y = Math.round(y)
  if (y < 0) return `${-y} av. J.-C.`
  if (y === 0) return '1'
  return String(y)
}

export function currentDecimalYear() {
  const d = new Date()
  return d.getFullYear() + d.getMonth() / 12 + (d.getDate() - 1) / 365
}
