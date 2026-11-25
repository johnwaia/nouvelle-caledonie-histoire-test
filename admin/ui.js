/*
 * Interface d'administration, commune à la version locale (local.js) et à la version en ligne (online.js).
 * backend.call(method, path, body) exécute une action ; backend.imageUrl(id) donne l'adresse d'une image de la base ;
 * backend.onChange() (facultatif) est appelé après chaque modification enregistrée.
 */

/* ---------- Description des formulaires ---------- */
const LINKS = { kind: 'rows', cols: [['label', 'Libellé'], ['url', 'https://…']] }
const names = (type, key = 'nom') => () => state[type].map((x) => [x[key], x[key]])

const TYPES = {
  events: {
    label: 'Événements', title: (e) => e.title, sub: (e) => `${e.date} · ${e.place}`, sort: (a, b) => parseInt(a.date) - parseInt(b.date) || a.date.localeCompare(b.date),
    fields: [
      ['title', 'Titre'],
      ['date', 'Date', { half: true, hint: 'AAAA, AAAA-MM ou AAAA-MM-JJ' }],
      ['endDate', 'Date de fin', { half: true, hint: 'facultatif' }],
      ['dateLabel', 'Texte affiché à la place de la date', { half: true, hint: 'facultatif' }],
      ['category', 'Catégorie', { half: true, kind: 'select', options: () => state.categories.map((c) => [c.id, c.label]) }],
      ['approx', 'Date approximative', { kind: 'check', half: true }],
      ['auSud', 'Placer sous les autres points de l’année', { kind: 'check', half: true }],
      ['place', 'Lieu'],
      ['coords', 'Coordonnées', { kind: 'coords', hint: 'vides si hors de l’archipel' }],
      ['description', 'Description', { kind: 'text', long: true, hint: 'une ligne vide sépare les paragraphes' }],
      ['logo', 'Logo sur la carte', { kind: 'select', empty: 'Icône de la catégorie', options: () => state.images.filter((i) => i.id.startsWith('images/logos/')).map((i) => [i.id, i.id.slice(13)]) }],
      ['image', 'Image', { kind: 'image', folder: 'evenements' }],
      ['sources', 'Sources', LINKS],
      ['videos', 'Vidéos', LINKS],
    ],
  },
  tribus: {
    label: 'Tribus', title: (t) => t.nom, sub: (t) => t.commune, defaults: { ajoutManuel: true },
    fields: [
      ['nom', 'Nom', { half: true }],
      ['nomLocal', 'Nom local', { half: true }],
      ['commune', 'Commune', { half: true, kind: 'select', options: names('communes') }],
      ['aire', 'Aire coutumière', { half: true, kind: 'select', options: names('aires') }],
      ['ile', 'Île', { hint: 'facultatif' }],
      ['coords', 'Coordonnées', { kind: 'coords' }],
      ['origines', 'Origines', { kind: 'text', long: true }],
      ['evenements', 'Événements', { kind: 'rows', cols: [['date', 'Date', 'short'], ['texte', 'Texte', 'area']] }],
      ['sources', 'Sources', LINKS],
      ['ajoutManuel', 'Conserver cette tribu lors d’un import officiel', { kind: 'check' }],
    ],
  },
  communes: {
    label: 'Communes', title: (c) => c.nom, sub: (c) => `Province ${c.province}`,
    fields: [
      ['nom', 'Nom'],
      ['province', 'Province', { half: true, kind: 'select', options: names('provinces', 'cle') }],
      ['aire', 'Aire coutumière', { half: true, kind: 'select', options: names('aires') }],
      ['coords', 'Coordonnées', { kind: 'coords' }],
      ['resume', 'Présentation', { kind: 'text' }],
      ['histoire', 'Histoire', { kind: 'text', long: true, hint: 'rechargée depuis Wikipédia par l’import' }],
      ['histoireManuelle', 'Histoire manuelle', { kind: 'text', long: true, hint: 'remplace la précédente si elle est remplie' }],
      ['wikipedia', 'Page Wikipédia'],
      ['image', 'Image', { kind: 'image', folder: 'communes' }],
      ['sources', 'Sources', LINKS],
    ],
  },
  aires: {
    label: 'Aires', fixed: true, title: (a) => a.nom,
    fields: [['nom', 'Nom'], ['couleur', 'Couleur', { kind: 'color' }], ['description', 'Description', { kind: 'text' }]],
  },
  provinces: {
    label: 'Provinces', fixed: true, title: (p) => p.nom,
    fields: [
      ['nom', 'Nom', { half: true }],
      ['cle', 'Nom court', { half: true }],
      ['chefLieu', 'Chef-lieu', { half: true }],
      ['couleur', 'Couleur', { kind: 'color', half: true }],
      ['description', 'Description', { kind: 'text' }],
    ],
  },
  categories: { label: 'Catégories', title: (c) => c.label, fields: [['label', 'Nom'], ['color', 'Couleur', { kind: 'color' }]] },
  periods: {
    label: 'Périodes', title: (p) => p.name, sub: (p) => `${p.from} – ${p.to ?? '…'}`,
    fields: [
      ['name', 'Nom'],
      ['from', 'Année de début', { kind: 'number', half: true }],
      ['to', 'Année de fin', { kind: 'number', half: true, hint: 'vide si en cours' }],
      ['color', 'Couleur', { kind: 'color' }],
    ],
  },
  images: {
    label: 'Images', title: (i) => i.id.split('/').pop().split('?')[0],
    sub: (i) => `${i.size ? `en base, ${Math.round(i.size / 1024)} Ko` : 'lien'} · ${i.uses ? `utilisée ${i.uses} fois` : 'non utilisée'}`,
  },
}

/* ---------- Outils ---------- */
let backend
let state = {}
let type = 'events'
let currentId = null
let dirty = false

const $ = (id) => document.getElementById(id)
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children.filter((c) => c !== null && c !== undefined))
  return node
}
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
// Un lien est affiché tel quel.
const src = (id) => (/^https?:\/\//.test(id) ? id : backend.imageUrl(id))

let toastTimer
export function toast(message, error = false) {
  const t = $('toast')
  t.textContent = message
  t.className = error ? 'error' : ''
  t.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (t.hidden = true), error ? 9000 : 4000)
}
async function call(method, path, body) {
  const data = await backend.call(method, path, body)
  if (method !== 'GET') backend.onChange?.()
  return data
}
export async function attempt(fn) {
  try {
    await fn()
  } catch (e) {
    toast(e.message, true)
  }
}
const refresh = async () => (state = await call('GET', 'state'))
const mayLeave = () => !dirty || confirm('Abandonner les modifications non enregistrées ?')

/* ---------- Liste ---------- */
function renderTabs() {
  $('tabs').replaceChildren(
    ...Object.entries(TYPES).map(([key, t]) => {
      const b = el('button', { type: 'button', textContent: `${t.label} (${state[key].length})` })
      b.setAttribute('aria-current', key === type)
      b.onclick = () => mayLeave() && show(key)
      return b
    }),
  )
}
function renderList() {
  const t = TYPES[type]
  const q = norm($('filter').value)
  const items = state[type].filter((i) => norm(`${t.title(i)} ${t.sub?.(i) || ''} ${i.id}`).includes(q))
  if (t.sort) items.sort(t.sort)
  $('add').hidden = !!t.fixed
  $('list').replaceChildren(
    ...items.map((item) => {
      const b = el('button', { type: 'button' }, t.title(item), t.sub && el('small', { textContent: t.sub(item) }))
      b.setAttribute('aria-current', item.id === currentId)
      b.onclick = () => mayLeave() && open(item)
      return el('li', {}, b)
    }),
  )
}
function show(key) {
  type = key
  $('filter').value = ''
  close()
  renderTabs()
}
function close() {
  currentId = null
  dirty = false
  $('editor').replaceChildren(el('p', { className: 'hint', textContent: 'Choisissez un élément dans la liste.' }))
  renderList()
}
function open(item) {
  currentId = item?.id ?? null
  dirty = false
  if (type === 'images') renderImage(item)
  else renderForm(item)
  renderList()
  $('editor').scrollTop = 0
}

/* ---------- Champs : chacun renvoie { node, get } ---------- */
const labelled = (label, hint, control) => el('label', {}, label, hint && el('small', { textContent: ` (${hint})` }), control)
const trimmed = (control) => control.value.trim() || undefined

const FIELDS = {
  input(value, label, o) {
    const c = el('input', { value: value ?? '' })
    return { node: labelled(label, o.hint, c), get: () => trimmed(c) }
  },
  number(value, label, o) {
    const c = el('input', { type: 'number', step: 'any', value: value ?? '' })
    return { node: labelled(label, o.hint, c), get: () => (c.value === '' ? null : Number(c.value)) }
  },
  text(value, label, o) {
    const c = el('textarea', { value: value ?? '', className: o.long ? 'long' : '' })
    return { node: labelled(label, o.hint, c), get: () => trimmed(c) }
  },
  check(value, label) {
    const c = el('input', { type: 'checkbox', checked: !!value })
    return { node: el('label', { className: 'check' }, c, label), get: () => c.checked || undefined }
  },
  color(value, label) {
    const c = el('input', { type: 'color', value: value ?? '#1f4d2e' })
    return { node: labelled(label + ' ', null, c), get: () => c.value }
  },
  select(value, label, o) {
    const c = el('select', {}, el('option', { value: '', textContent: o.empty || '— choisir —' }), ...o.options().map(([v, t]) => el('option', { value: v, textContent: t })))
    c.value = value ?? ''
    return { node: labelled(label, o.hint, c), get: () => c.value || undefined }
  },
  coords(value, label, o) {
    const [lat, lon] = [0, 1].map((i) => el('input', { type: 'number', step: 'any', value: value?.[i] ?? '', placeholder: ['Latitude', 'Longitude'][i], ariaLabel: ['Latitude', 'Longitude'][i] }))
    return {
      node: el('fieldset', {}, el('legend', { textContent: label + (o.hint ? ` (${o.hint})` : '') }), el('div', { className: 'row' }, lat, lon)),
      get: () => (lat.value === '' && lon.value === '' ? null : [lat, lon].map((c) => (c.value === '' ? null : Number(c.value)))),
    }
  },
  rows(value, label, o) {
    const box = el('div')
    const addRow = (row = {}) => {
      const controls = o.cols.map(([key, name, style]) =>
        el(style === 'area' ? 'textarea' : 'input', { value: row[key] ?? '', placeholder: name, ariaLabel: `${label} : ${name}`, className: style === 'short' ? 'short' : '' }),
      )
      const remove = el('button', { type: 'button', textContent: '×', ariaLabel: 'Retirer' })
      const line = el('div', { className: 'row' }, ...controls, remove)
      line.controls = controls
      remove.onclick = () => {
        line.remove()
        dirty = true
      }
      box.append(line)
    }
    for (const row of value || []) addRow(row)
    const add = el('button', { type: 'button', textContent: 'Ajouter une ligne', onclick: () => addRow() })
    return {
      node: el('fieldset', {}, el('legend', { textContent: label }), box, add),
      get: () =>
        [...box.children]
          .map((line) => Object.fromEntries(o.cols.map(([key], i) => [key, trimmed(line.controls[i])])))
          .filter((row) => Object.values(row).some(Boolean)),
    }
  },
  image(value, label, o) {
    const url = el('input', { value: value?.url ?? '', placeholder: 'Image de la base ou lien https://…', ariaLabel: 'Image' })
    url.setAttribute('list', 'image-ids')
    const ids = el('datalist', { id: 'image-ids' }, ...state.images.filter((i) => !i.id.startsWith('images/logos/')).map((i) => el('option', { value: i.id })))
    const meta = { alt: 'Description de l’image', credit: 'Crédit (auteur, licence)', source: 'Page d’origine (https://…)' }
    const inputs = Object.fromEntries(Object.entries(meta).map(([k, name]) => [k, el('input', { value: value?.[k] ?? '', placeholder: name, ariaLabel: name })]))
    const preview = el('img', { className: 'preview', alt: '' })
    const update = () => {
      const id = url.value.trim()
      preview.hidden = !id
      if (id) preview.src = src(id)
    }
    // Une image déjà connue reprend son crédit et sa source.
    url.onchange = () => {
      const known = state.images.find((i) => i.id === url.value.trim())
      if (known) for (const k of ['credit', 'source']) inputs[k].value = known[k] ?? ''
      update()
    }
    const file = el('input', { type: 'file', accept: 'image/*', ariaLabel: 'Envoyer un fichier' })
    file.onchange = () => attempt(async () => {
      const id = await upload(file.files[0], o.folder)
      if (!id) return
      url.value = id
      dirty = true
      update()
      toast('Image envoyée. Enregistrez la fiche pour l’utiliser.')
    })
    update()
    return {
      node: el('fieldset', {}, el('legend', { textContent: label }), ids, el('div', { className: 'image-field' }, preview, el('div', {}, url, file, ...Object.values(inputs)))),
      get: () => {
        if (!url.value.trim()) return undefined
        return { url: url.value.trim(), ...Object.fromEntries(Object.entries(inputs).map(([k, c]) => [k, trimmed(c)])) }
      },
    }
  },
}

async function upload(file, folder, id) {
  if (!file) return null
  const ext = file.name.split('.').pop().toLowerCase()
  const target = id || `images/${folder}/${slug(file.name.replace(/\.[^.]+$/, '')) || 'image'}.${ext}`
  await call('POST', `images/${encodeURIComponent(target)}${id ? '?replace=1' : ''}`, file)
  state.images = (await call('GET', 'state')).images
  return target
}

/* ---------- Formulaire ---------- */
function renderForm(item) {
  const t = TYPES[type]
  const value = item || t.defaults || {}
  const form = el('form')
  form.append(el('h2', { textContent: item ? t.title(item) : 'Nouvel élément' }))
  const idInput = el('input', { value: item?.id ?? '', disabled: !!item })
  form.append(labelled('Identifiant', item ? 'non modifiable' : 'a-z, 0-9 et tirets ; proposé automatiquement', idInput))

  const getters = {}
  t.fields.forEach(([key, label, o = {}], i) => {
    const f = FIELDS[o.kind || 'input'](value[key], label, o)
    if (o.half) f.node.classList.add('half')
    getters[key] = f.get
    form.append(f.node)
    // Identifiant proposé à partir du premier champ (titre, nom…)
    if (!item && i === 0) {
      f.node.querySelector('input').addEventListener('input', () => {
        if (!idInput.dataset.edited) idInput.value = slug(f.get())
      })
    }
  })
  idInput.addEventListener('input', () => (idInput.dataset.edited = '1'))

  const actions = el('div', { className: 'actions' }, el('button', { className: 'primary', textContent: 'Enregistrer' }))
  if (item && !t.fixed) actions.append(deleteButton(item.id, t.title(item)))
  form.append(actions)
  form.addEventListener('input', () => (dirty = true))
  form.onsubmit = (e) => {
    e.preventDefault()
    attempt(async () => {
      const data = { id: idInput.value.trim(), ...Object.fromEntries(Object.entries(getters).map(([k, get]) => [k, get()])) }
      const { warnings } = await call(item ? 'PUT' : 'POST', `${type}/${encodeURIComponent(data.id)}`, data)
      await refresh()
      renderTabs()
      open(state[type].find((x) => x.id === data.id))
      toast(['Enregistré.', ...warnings.map((w) => `Attention : ${w}`)].join('\n'))
    })
  }
  $('editor').replaceChildren(form)
}
function deleteButton(id, title) {
  const b = el('button', { type: 'button', className: 'danger', textContent: 'Supprimer' })
  b.onclick = () => {
    if (!confirm(`Supprimer « ${title} » ?`)) return
    attempt(async () => {
      await call('DELETE', `${type}/${encodeURIComponent(id)}`)
      await refresh()
      renderTabs()
      close()
      toast('Supprimé.')
    })
  }
  return b
}

/* ---------- Images ---------- */
function renderImage(image) {
  const form = el('form')
  const file = el('input', { type: 'file', accept: 'image/*' })
  if (!image) {
    const folder = el('select', {}, ...[['evenements', 'Événements'], ['logos', 'Logos de la carte'], ['communes', 'Communes']].map(([v, t]) => el('option', { value: v, textContent: t })))
    form.append(el('h2', { textContent: 'Nouvelle image' }), labelled('Dossier', null, folder), labelled('Fichier', '8 Mo au maximum', file), el('div', { className: 'actions' }, el('button', { className: 'primary', textContent: 'Envoyer' })))
    form.onsubmit = (e) => {
      e.preventDefault()
      attempt(async () => {
        const id = await upload(file.files[0], folder.value)
        if (!id) throw new Error('Choisissez un fichier')
        await done(id, 'Image ajoutée.')
      })
    }
    return $('editor').replaceChildren(form)
  }
  const credit = el('input', { value: image.credit ?? '' })
  const source = el('input', { value: image.source ?? '' })
  const actions = el('div', { className: 'actions' }, el('button', { className: 'primary', textContent: 'Enregistrer' }))
  if (!image.uses) actions.append(deleteButton(image.id, TYPES.images.title(image)))
  form.append(el('h2', { textContent: image.id }), el('img', { className: 'big', src: src(image.id), alt: '' }), labelled('Crédit', null, credit), labelled('Page d’origine', null, source))
  if (image.size) form.append(labelled('Remplacer le fichier', 'même format', file))
  form.append(actions)
  form.addEventListener('input', () => (dirty = true))
  form.onsubmit = (e) => {
    e.preventDefault()
    attempt(async () => {
      if (file.files[0]) {
        if (file.files[0].name.split('.').pop().toLowerCase() !== image.id.split('.').pop().toLowerCase()) throw new Error('Le nouveau fichier doit avoir le même format')
        await upload(file.files[0], null, image.id)
      }
      await call('PUT', `images/${encodeURIComponent(image.id)}`, { id: image.id, credit: credit.value.trim(), source: source.value.trim() })
      await done(image.id, 'Enregistré.')
    })
  }
  $('editor').replaceChildren(form)
}
async function done(id, message) {
  await refresh()
  renderTabs()
  open(state.images.find((i) => i.id === id))
  toast(message)
}

/* ---------- Démarrage ---------- */
$('filter').oninput = renderList
$('add').onclick = () => mayLeave() && open(null)
window.addEventListener('beforeunload', (e) => (dirty || backend?.pending?.()) && e.preventDefault())
export const isDirty = () => dirty
export async function startAdmin(chosenBackend) {
  backend = chosenBackend
  await refresh()
  show('events')
}
