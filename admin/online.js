/*
 * Version en ligne : la base du dépôt est ouverte dans le navigateur, puis republiée par un commit GitHub.
 * Le commit déclenche la publication du site (.github/workflows/deploy.yml).
 * Le jeton reste en mémoire : il n'est écrit nulle part.
 */
import { openBrowserDb } from '../src/db/browser.js'
import { handle } from '../src/db/api.js'
import { attempt, isDirty, startAdmin, toast } from './ui.js'

// Dépôt et branche d'où le site a été publié (voir vite.config.js)
const REPO = __REPO__
const BRANCH = __BRANCH__
const DB_PATH = 'database/kanaky.sqlite'

const $ = (id) => document.getElementById(id)
let token = ''
for (const node of document.querySelectorAll('.repo-name')) node.textContent = REPO.split('/')[1]
document.querySelector('.target').textContent = `${REPO} · ${BRANCH}`

/* ---------- GitHub ---------- */
const MESSAGES = {
  401: 'Jeton refusé ou expiré.',
  403: "Le jeton n'a pas le droit de modifier le dépôt (« Contents : Read and write »).",
  404: 'Dépôt ou base introuvable : vérifiez que le jeton donne accès à ce dépôt.',
  409: 'Le dépôt a changé entre-temps : réessayez.',
  422: 'Le dépôt a changé entre-temps : réessayez.',
}
async function github(method, path, body, accept = 'application/vnd.github+json') {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' },
    body: body && JSON.stringify(body),
  })
  if (!res.ok) throw new Error(MESSAGES[res.status] || `GitHub a répondu ${res.status}`)
  return accept.endsWith('raw') ? res.arrayBuffer() : res.json()
}

// Dernier commit de la branche, et empreinte de la base qu'il contient
async function readHead() {
  const { commit } = await github('GET', `/branches/${BRANCH}`)
  const folder = await github('GET', `/contents/${DB_PATH.split('/')[0]}?ref=${commit.sha}`)
  const file = folder.find((f) => f.path === DB_PATH)
  if (!file) throw new Error(`La base n'est pas encore sur la branche ${BRANCH}.`)
  return { commit: commit.sha, tree: commit.commit.tree.sha, blob: file.sha }
}

function toBase64(bytes) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result.slice(r.result.indexOf(',') + 1))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(new Blob([bytes]))
  })
}

/* ---------- Base ouverte dans la page ---------- */
let db
let loadedBlob // empreinte de la base chargée : évite d'écraser le travail de quelqu'un d'autre
let changes = 0
let publishing = false
const imageUrls = new Map()

function imageUrl(id) {
  if (!imageUrls.has(id)) {
    const row = db.prepare('SELECT mime, data FROM image_data WHERE image_id = ?').get(id)
    imageUrls.set(id, row ? URL.createObjectURL(new Blob([row.data], { type: row.mime })) : '')
  }
  return imageUrls.get(id)
}
function forgetImage(id) {
  if (imageUrls.get(id)) URL.revokeObjectURL(imageUrls.get(id))
  imageUrls.delete(id)
}

async function call(method, path, body) {
  if (publishing && method !== 'GET') throw new Error('Publication en cours : patientez.')
  const upload = body instanceof Blob
  const result = handle(db, method, path, upload ? new Uint8Array(await body.arrayBuffer()) : body)
  if (path.startsWith('images/')) forgetImage(decodeURIComponent(path.split('?')[0].slice('images/'.length)))
  return result
}

function showPending() {
  $('pending').textContent = changes ? `${changes} modification${changes > 1 ? 's' : ''} à publier` : 'Tout est publié'
  $('publish').disabled = !changes || publishing
  $('publish').textContent = publishing ? 'Publication…' : 'Publier'
}

async function publish() {
  if (isDirty()) throw new Error("Enregistrez ou abandonnez d'abord la fiche ouverte.")
  const head = await readHead()
  if (head.blob !== loadedBlob) {
    throw new Error("La base a été modifiée ailleurs depuis votre connexion. Notez vos changements, rechargez la page et refaites-les.")
  }
  const published = changes
  const blob = await github('POST', '/git/blobs', { content: await toBase64(db.export()), encoding: 'base64' })
  const tree = await github('POST', '/git/trees', {
    base_tree: head.tree,
    tree: [{ path: DB_PATH, mode: '100644', type: 'blob', sha: blob.sha }],
  })
  const commit = await github('POST', '/git/commits', {
    message: `data: mise à jour depuis l'administration (${published} modification${published > 1 ? 's' : ''})`,
    tree: tree.sha,
    parents: [head.commit],
  })
  await github('PATCH', `/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false })
  loadedBlob = blob.sha
  changes -= published
  toast('Publié. Le site sera à jour dans une à deux minutes.')
}

$('publish').onclick = () =>
  attempt(async () => {
    publishing = true
    showPending()
    try {
      await publish()
    } finally {
      publishing = false
      showPending()
    }
  })

/* ---------- Connexion ---------- */
$('login').onsubmit = (e) => {
  e.preventDefault()
  const button = $('login').querySelector('button')
  button.disabled = true
  button.textContent = 'Chargement…'
  attempt(async () => {
    try {
      token = $('token').value.trim()
      const repo = await github('GET', '')
      if (!repo.permissions?.push) throw new Error(MESSAGES[403])
      const head = await readHead()
      db = await openBrowserDb(github('GET', `/git/blobs/${head.blob}`, undefined, 'application/vnd.github.raw'))
      loadedBlob = head.blob
      $('token').value = ''
      await startAdmin({
        call,
        imageUrl,
        pending: () => changes > 0,
        onChange() {
          changes++
          showPending()
        },
      })
      showPending()
      $('login').remove()
      document.querySelector('main').hidden = false
      document.querySelector('.publish').hidden = false
    } catch (err) {
      token = ''
      throw err
    } finally {
      button.disabled = false
      button.textContent = 'Se connecter'
    }
  })
}
