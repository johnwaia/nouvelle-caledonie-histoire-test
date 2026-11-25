<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import { iconFor } from '../utils/icons'

const props = defineProps({
  events: { type: Array, default: () => [] },       // événements de l'année sélectionnée
  categories: { type: Object, default: () => ({}) },
  selectedEvent: { type: Object, default: null },
  year: { type: Number, default: null },
  tribus: { type: Array, default: () => [] },       // tribus visibles pour l'année choisie (une case chacune)
  selectedTribuId: { type: String, default: null },
  communes: { type: Array, default: () => [] },     // communes à afficher
  selectedCommuneId: { type: String, default: null },
  focusTarget: { type: Object, default: null },     // { coords, zoom, key } : résultat de recherche à montrer
  aires: { type: Object, default: null },            // GeoJSON des aires coutumières à afficher (ou null)
  selectedAireId: { type: String, default: null },
  provinces: { type: Object, default: null },        // GeoJSON des provinces à afficher (ou null)
  land: { type: Object, default: null },             // GeoJSON de la terre ferme (pour garder les points hors de la mer)
  selectedProvinceId: { type: String, default: null },
})
const emit = defineEmits(['select', 'select-tribu', 'select-commune', 'select-aire', 'select-province'])

const el = ref(null)
// L'objet Leaflet ne doit pas être réactif : variables simples.
let map = null
let layer = null
let tribusLayer = null
const tribuMarkers = new Map()
let communesLayer = null
const communeMarkers = new Map()
let resizeObserver = null
let prevIds = new Set()
let lastSignature = ''
let lastYear = null
const FADE_MS = 280

const NC_BOUNDS = L.latLngBounds([-22.9, 163.5], [-19.5, 168.3])

const offMap = computed(() => props.events.filter((e) => !e.coords))
const onMapCount = computed(() => props.events.length - offMap.value.length)
const wideScreen = window.innerWidth > 760

/*
 * Fond de carte : les tuiles Esri « Light Gray » sont recolorées à la volée.
 * Les terres (gris très clair) deviennent vertes ; la mer (gris bleuté plus sombre) ne change pas.
 */
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/'
const LAND = [139, 190, 112] // vert des terres
const SEA_L = 212 // luminosité max de la mer
const LAND_L = 236 // luminosité min des terres
const GreenLandLayer = L.GridLayer.extend({
  createTile(coords, done) {
    const tile = document.createElement('canvas')
    const size = this.getTileSize()
    tile.width = size.x
    tile.height = size.y
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const ctx = tile.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, size.x, size.y)
      try {
        const data = ctx.getImageData(0, 0, size.x, size.y)
        const px = data.data
        for (let i = 0; i < px.length; i += 4) {
          const l = (px[i] + px[i + 1] + px[i + 2]) / 3
          const t = Math.min(1, Math.max(0, (l - SEA_L) / (LAND_L - SEA_L)))
          if (!t) continue
          const k = (l / 239) * t // garde les nuances (limites, reliefs)
          px[i] = px[i] * (1 - t) + LAND[0] * k
          px[i + 1] = px[i + 1] * (1 - t) + LAND[1] * k
          px[i + 2] = px[i + 2] * (1 - t) + LAND[2] * k
        }
        ctx.putImageData(data, 0, 0)
      } catch {
        /* tuile sans CORS : on la laisse telle quelle */
      }
      done(null, tile)
    }
    img.onerror = (err) => done(err, tile)
    img.src = `${ESRI}World_Light_Gray_Base/MapServer/tile/${coords.z}/${coords.y}/${coords.x}`
    return tile
  },
})

/* Icône de tribu : une case. */
const CASE_IMG = import.meta.env.BASE_URL + 'images/case_kanak_icone.png'
const tribuIcon = L.divIcon({
  className: 'tribu-icon',
  html: `<span class="tribu"><img class="tribu-case" src="${CASE_IMG}" alt=""></span>`,
  iconSize: [18, 15],
  iconAnchor: [9, 13],
})

/*
 * Crédits de la carte : un petit bouton « i » qui affiche les mentions obligatoires
 * (conditions d'Esri, licence ODbL d'OpenStreetMap, source DITTT pour les tribus).
 */
const CREDITS =
  'Fond de carte © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, HERE, Garmin' +
  ' · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">contributeurs OpenStreetMap</a>' +
  ' · Tribus : Gouvernement de la Nouvelle-Calédonie / D.I.T.T.T.' +
  ' · <a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>' +
  ' · <a href="admin.html">Administration</a>'
function addCreditsControl() {
  const Credits = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd() {
      const box = L.DomUtil.create('div', 'map-credits')
      box.innerHTML =
        '<button type="button" class="map-credits-btn" aria-expanded="false" aria-label="Crédits de la carte" title="Crédits de la carte">i</button>' +
        `<div class="map-credits-text" hidden>${CREDITS}</div>`
      const btn = box.querySelector('button')
      const text = box.querySelector('div')
      const toggle = (open) => {
        text.hidden = !open
        btn.setAttribute('aria-expanded', String(open))
      }
      btn.addEventListener('click', () => toggle(text.hidden))
      map.on('click movestart', () => toggle(false)) // se referme dès qu'on touche la carte
      L.DomEvent.disableClickPropagation(box)
      L.DomEvent.disableScrollPropagation(box)
      return box
    },
  })
  new Credits().addTo(map)
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])

onMounted(() => {
  map = L.map(el.value, {
    zoomSnap: 0.25,
    minZoom: 6,
    maxZoom: 16,
    maxBounds: NC_BOUNDS.pad(1.5),
    attributionControl: false, // remplacée par le bouton « i » des crédits (obligatoires : Esri, OSM, DITTT)
  })
  addCreditsControl()

  // Fond de carte épuré (Esri « Light Gray Canvas », terres recolorées en vert) + principaux noms de lieux.
  new GreenLandLayer({
    maxZoom: 16,
  }).addTo(map)
  L.tileLayer(ESRI + 'World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }).addTo(map)

  // Les tribus sont sous les points d'événements (volet dédié, juste en dessous des marqueurs).
  map.createPane('tribus').style.zIndex = 580
  tribusLayer = L.layerGroup().addTo(map)
  syncTribus()

  // Aires coutumières : sous tous les marqueurs, au-dessus du fond de carte.
  map.createPane('aires').style.zIndex = 350
  map.createPane('aires-labels').style.zIndex = 560
  map.getPane('aires-labels').style.pointerEvents = 'none'
  syncAires()
  syncProvinces()

  // Communes : étiquettes au-dessus des tribus, sous les points d'événements.
  map.createPane('communes').style.zIndex = 590
  communesLayer = L.layerGroup().addTo(map)
  syncCommunes()

  map.fitBounds(NC_BOUNDS)
  layer = L.layerGroup().addTo(map)
  render()
  map.on('zoomend', replacePins)

  // Tant que l'utilisateur n'a pas manipulé la carte, on recadre l'archipel entier
  // à chaque redimensionnement (apparition de la frise, rotation d'écran…).
  let userMoved = false
  for (const evt of ['mousedown', 'touchstart', 'wheel', 'keydown']) {
    el.value.addEventListener(evt, () => (userMoved = true), { once: true, passive: true })
  }
  resizeObserver = new ResizeObserver(() => {
    map.invalidateSize()
    if (!userMoved) map.fitBounds(NC_BOUNDS)
  })
  resizeObserver.observe(el.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  map?.remove()
})

/* ---------- Placement des points sur la terre ferme ---------- */
// Logos plantés dans le sol (drapeau, poing levé) : position de leur pied dans l'image, en fraction de sa taille.
const FEET = { drapeau_: [0.2, 0.93], foulard_rouge: [0.44, 1], usine_nickel: [0.5, 1] }
const footOf = (e) => Object.entries(FEET).find(([name]) => e.logo?.includes(name))?.[1]
const pinSize = (e) => {
  if (e.logo?.includes('usine_nickel')) return 56 // la fumée occupe le haut de l'image
  if (e.logo?.includes('urne')) return 44 // la croix du boycott doit laisser voir l'urne
  if (e.auSud && map.getSize().x <= 760) return 32 // mobile : peu de terre au sud
  if (footOf(e)) return 42
  return e.logo ? 34 : 28
}

// Point dans un polygone GeoJSON (anneaux [lon, lat]), par la méthode du rayon.
function inRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function inPolygon(lon, lat, rings) {
  return inRing(lon, lat, rings[0]) && !rings.slice(1).some((hole) => inRing(lon, lat, hole))
}
// Terre ferme = intérieur des provinces (contours qui suivent le littoral).
// Index calculé une seule fois : chaque polygone avec son rectangle englobant, pour n'examiner
// en détail que les quelques polygones autour du point (plus de 2 000 îles et îlots au total).
let landIndex = null
function buildLandIndex(geojson) {
  const index = []
  for (const f of geojson?.features || []) {
    const g = f.geometry
    for (const rings of g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]) {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const [x, y] of rings[0]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
      index.push({ minX, minY, maxX, maxY, rings })
    }
  }
  return index
}
const landCache = new Map() // résultats déjà calculés (point arrondi à ~10 m)
function isOnLand(latlng) {
  if (!props.land) return true // contours pas encore chargés : on ne bloque rien
  landIndex ??= buildLandIndex(props.land)
  const key = `${latlng.lat.toFixed(4)},${latlng.lng.toFixed(4)}`
  if (landCache.has(key)) return landCache.get(key)
  const { lat, lng } = latlng
  const result = landIndex.some(
    (p) => lng >= p.minX && lng <= p.maxX && lat >= p.minY && lat <= p.maxY && inPolygon(lng, lat, p.rings),
  )
  if (landCache.size > 20000) landCache.clear()
  landCache.set(key, result)
  return result
}

// Positions d'essai autour d'un lieu, de la plus proche à la plus éloignée (en pixels).
const SPOTS = [[0, 0]]
for (let r = 5; r <= 150; r += 5) {
  const steps = Math.max(8, Math.round(r / 2.5))
  for (let k = 0; k < steps; k++) {
    const a = -Math.PI / 2 + (2 * Math.PI * k) / steps
    SPOTS.push([r * Math.cos(a), r * Math.sin(a)])
  }
}
const PIN_GAP = 3 // espace minimal entre deux points
const SOUTH_REACH = 65 // éloignement maximal d'un point « auSud » (sinon il change d'île)
const FOOT_MARGIN = 7 // largeur de terre exigée autour du pied d'un logo planté

// Décalage de chaque point (en pixels) : au plus près de son lieu, sans recouvrir un autre point
// de la carte et, autant que possible, sur la terre ferme.
// Les événements « auSud » sont posés en dernier, plus bas que tous les autres.
function layoutPins(list) {
  const placed = [] // centres et tailles des points déjà posés
  const spots = new Map()
  let southOf = -Infinity // bas des points ordinaires
  for (const e of [...list].sort((a, b) => !!a.auSud - !!b.auSud)) {
    const base = map.latLngToContainerPoint(e.coords)
    const size = pinSize(e)
    const [fx, fy] = footOf(e) || [0.5, 0.5]
    const center = ([dx, dy]) => ({ x: base.x + dx + size * (0.5 - fx), y: base.y + dy + size * (0.5 - fy), size })
    const isFree = (spot, tightness = 1) => {
      const c = center(spot)
      if (e.auSud && c.y < southOf) return false
      return placed.every((q) => {
        const min = ((c.size + q.size) / 2 + PIN_GAP) * tightness
        return Math.abs(c.x - q.x) >= min || Math.abs(c.y - q.y) >= min
      })
    }
    const m = footOf(e) ? FOOT_MARGIN : 0
    const footOnLand = ([dx, dy]) => isOnLand(map.containerPointToLatLng(base.add([dx, dy])))
    const around = m ? [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]] : [[0, 0]]
    const onLand = ([dx, dy]) =>
      around.every(([mx, my]) => isOnLand(map.containerPointToLatLng(base.add([dx + mx, dy + my]))))
    const near = e.auSud ? SPOTS.filter(([dx, dy]) => Math.hypot(dx, dy) <= SOUTH_REACH) : SPOTS
    const spot =
      near.find((o) => isFree(o) && onLand(o)) ||
      near.find((o) => isFree(o) && footOnLand(o)) ||
      // Pas assez de place : plutôt serrer les points « auSud » que d'en poser un dans l'eau.
      (e.auSud && (near.find((o) => isFree(o, 0.8) && footOnLand(o)) || near.find((o) => isFree(o, 0.6) && footOnLand(o)))) ||
      near.find((o) => isFree(o)) ||
      SPOTS.find((o) => isFree(o)) ||
      SPOTS[0]
    const c = center(spot)
    placed.push(c)
    if (!e.auSud) southOf = Math.max(southOf, c.y + c.size / 2)
    spots.set(e, spot)
  }
  return list.map((e) => spots.get(e))
}

function render() {
  if (!map) return
  const items = props.events.filter((e) => e.coords).map((e) => ({ e }))
  const selId = props.selectedEvent?.id
  const signature = items.map((i) => i.e.id).join('|') + '#' + selId
  if (signature === lastSignature) return
  lastSignature = signature

  // Changement d'année : les anciens points s'effacent en fondu pendant que les nouveaux apparaissent.
  const yearChanged = props.year !== lastYear
  lastYear = props.year
  if (yearChanged && layer.getLayers().length) {
    const old = layer
    old.eachLayer((m) => {
      m.closeTooltip()
      m.getElement()?.classList.add('pin-leaving')
    })
    setTimeout(() => map?.removeLayer(old), FADE_MS)
    layer = L.layerGroup().addTo(map)
    prevIds = new Set()
  } else {
    layer.clearLayers()
  }

  // Les points trop proches sont écartés les uns des autres, en restant sur la terre ferme.
  const offsets = layoutPins(items.map((it) => it.e))
  const nextIds = new Set()
  items.forEach((it, i) => {
    const [dx, dy] = offsets[i]
    const selected = it.e.id === selId
    const fresh = !prevIds.has(it.e.id)
    const foot = footOf(it.e)
    const cls = [
      'pin',
      it.e.logo && 'pin-logo',
      it.e.logo?.includes('urne') && 'pin-urne',
      foot && 'pin-flag',
      selected && 'selected',
      fresh && (yearChanged ? 'entering' : 'fresh'),
    ]
      .filter(Boolean)
      .join(' ')
    const color = props.categories[it.e.category]?.color || '#555'
    const size = pinSize(it.e)
    // Point d'ancrage : centre du rond, ou pied d'un logo planté dans le sol
    const [fx, fy] = foot || [0.5, 0.5]
    const [ax, ay] = [size * fx, size * fy]

    const icon = L.divIcon({
      className: 'pin-icon',
      // Logo de l'événement (selon sa catégorie) dans un rond de la couleur de la catégorie
      html: `<span class="${cls}" style="--c:${color};--size:${size}px;--foot:${fx * 100}% ${fy * 100}%">${
        it.e.logo ? `<img src="${esc(it.e.logo)}" alt="">` : iconFor(it.e.category)
      }</span>`,
      iconSize: [size, size],
      iconAnchor: [ax - dx, ay - dy],
    })
    const marker = L.marker(it.e.coords, {
      icon,
      keyboard: true,
      alt: it.e.title,
      zIndexOffset: selected ? 1000 : 0,
    })
    marker.bindTooltip(
      `<strong>${esc(it.e.title)}</strong><br><span>${esc(it.e.dateText)} · ${esc(it.e.place)}</span>`,
      { direction: 'top', offset: [dx, dy - (foot ? size * 0.85 : 14)], className: 'pin-tooltip' },
    )
    marker.on('click', () => emit('select', it.e.id))
    marker.addTo(layer)
    nextIds.add(it.e.id)
  })
  prevIds = nextIds
}

watch(() => [props.events, props.selectedEvent, props.categories, props.year], render)
// Le décalage en pixels change de sens géographique avec le zoom : on replace les points.
function replacePins() {
  lastSignature = ''
  render()
}
watch(
  () => props.land,
  () => {
    landIndex = null // nouveaux contours : index et cache à refaire
    landCache.clear()
    replacePins()
  },
)
/* ---------- Zones colorées : aires coutumières et provinces ---------- */
// Point où écrire le nom d'une zone : centre de sa plus grande partie (et non du rectangle
// englobant toutes ses îles, qui tombe souvent en mer).
function labelPoint(lyr) {
  const parts = lyr.feature.geometry.type === 'MultiPolygon' ? lyr.getLatLngs() : [lyr.getLatLngs()]
  let best = null
  let bestArea = -1
  for (const part of parts) {
    const bounds = L.latLngBounds(part[0] || part)
    const area = (bounds.getNorth() - bounds.getSouth()) * (bounds.getEast() - bounds.getWest())
    if (area > bestArea) [best, bestArea] = [bounds, area]
  }
  return best ? best.getCenter() : lyr.getBounds().getCenter()
}

// Dessine un découpage (GeoJSON) : polygones colorés, nom au centre, clic → fiche.
function zoneLayer(geojson, selectedId, eventName) {
  const group = L.layerGroup()
  const shapes = L.geoJSON(geojson, {
    pane: 'aires',
    style: (f) => ({
      color: f.properties.couleur,
      weight: f.properties.id === selectedId ? 3 : 1.5,
      fillColor: f.properties.couleur,
      fillOpacity: f.properties.id === selectedId ? 0.45 : 0.25,
    }),
    onEachFeature: (f, lyr) => {
      lyr.on('click', () => emit(eventName, f.properties.id))
      lyr.on('mouseover', () => lyr.setStyle({ fillOpacity: 0.4 }))
      lyr.on('mouseout', () => shapes.resetStyle(lyr))
      L.tooltip({ permanent: true, direction: 'center', className: 'aire-label', pane: 'aires-labels' })
        .setLatLng(labelPoint(lyr))
        .setContent(esc(f.properties.nom))
        .addTo(group)
    },
  })
  shapes.addTo(group)
  return group.addTo(map)
}

let airesLayer = null
function syncAires() {
  if (!map) return
  if (airesLayer) map.removeLayer(airesLayer)
  airesLayer = props.aires ? zoneLayer(props.aires, props.selectedAireId, 'select-aire') : null
}
watch(() => [props.aires, props.selectedAireId], syncAires)

let provincesLayer = null
function syncProvinces() {
  if (!map) return
  if (provincesLayer) map.removeLayer(provincesLayer)
  provincesLayer = props.provinces ? zoneLayer(props.provinces, props.selectedProvinceId, 'select-province') : null
}
watch(() => [props.provinces, props.selectedProvinceId], syncProvinces)

/* ---------- Tribus ---------- */
// Ajoute / retire les cases selon l'année : les nouvelles tribus apparaissent avec une petite animation.
function syncTribus() {
  if (!map) return
  const wanted = new Map(props.tribus.filter((t) => Array.isArray(t.coords)).map((t) => [t.id, t]))
  for (const [id, m] of tribuMarkers) {
    if (!wanted.has(id)) {
      tribusLayer.removeLayer(m)
      tribuMarkers.delete(id)
    }
  }
  for (const [id, t] of wanted) {
    if (tribuMarkers.has(id)) continue
    const marker = L.marker(t.coords, { pane: 'tribus', icon: tribuIcon, keyboard: true, alt: `Tribu de ${t.nom}` })
    marker.bindTooltip(`<strong>Tribu de ${esc(t.nom)}</strong><br><span>${esc(t.commune)}${t.aire ? ' · aire ' + esc(t.aire) : ''}</span>`, {
      direction: 'top',
      offset: [0, -11],
      className: 'pin-tooltip',
    })
    marker.on('click', () => emit('select-tribu', id))
    marker.addTo(tribusLayer)
    tribuMarkers.set(id, marker)
  }
  highlightTribu()
}
function highlightTribu() {
  for (const [id, m] of tribuMarkers) m.getElement()?.classList.toggle('active', id === props.selectedTribuId)
}
watch(() => props.tribus, syncTribus)
watch(() => props.selectedTribuId, highlightTribu)

/* ---------- Communes ---------- */
function syncCommunes() {
  if (!map) return
  const wanted = new Map(props.communes.filter((c) => Array.isArray(c.coords)).map((c) => [c.id, c]))
  for (const [id, m] of communeMarkers) {
    if (!wanted.has(id)) {
      communesLayer.removeLayer(m)
      communeMarkers.delete(id)
    }
  }
  for (const [id, c] of wanted) {
    if (communeMarkers.has(id)) continue
    const marker = L.marker(c.coords, {
      pane: 'communes',
      icon: L.divIcon({
        className: 'commune-icon',
        html: `<span class="commune-pin"></span><span class="commune-label">${esc(c.nom)}</span>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
      keyboard: true,
      alt: `Commune de ${c.nom}`,
    })
    marker.on('click', () => emit('select-commune', id))
    marker.addTo(communesLayer)
    communeMarkers.set(id, marker)
  }
  highlightCommune()
}
function highlightCommune() {
  for (const [id, m] of communeMarkers) m.getElement()?.classList.toggle('active', id === props.selectedCommuneId)
}
watch(() => props.communes, syncCommunes)
watch(() => props.selectedCommuneId, highlightCommune)

// Résultat du moteur de recherche : on centre la carte dessus.
watch(
  () => props.focusTarget?.key,
  () => {
    const t = props.focusTarget
    if (!map || !t?.coords) return
    map.flyTo(t.coords, t.zoom, { duration: 0.9 })
    // Le panneau d'information couvre la droite (ordinateur) ou le bas (mobile) : on décale la vue.
    map.once('moveend', () => {
      const size = map.getSize()
      if (window.innerWidth > 760) map.panBy([Math.min(210, size.x / 4), 0])
      else map.panBy([0, Math.round(size.y * 0.3)])
    })
  },
)

// Recentre la carte si l'événement choisi est hors champ.
watch(
  () => props.selectedEvent,
  (ev) => {
    if (!map || !ev?.coords) return
    if (!map.getBounds().pad(-0.15).contains(ev.coords)) {
      map.flyTo(ev.coords, Math.max(map.getZoom(), 8.5), { duration: 0.8 })
    }
  },
)
</script>

<template>
  <div class="map-wrap">
    <div ref="el" class="map" aria-label="Carte de la Nouvelle-Calédonie"></div>

    <details v-if="offMap.length" class="map-panel map-offmap" :open="wideScreen">
      <summary>Hors de l'archipel ({{ offMap.length }})</summary>
      <button v-for="e in offMap" :key="e.id" class="offmap-item" @click="emit('select', e.id)">
        <span class="swatch" :style="{ background: categories[e.category]?.color }"></span>
        <span>{{ e.title }}<small>{{ e.dateText }} · {{ e.place }}</small></span>
      </button>
    </details>

    <div v-if="events.length && !onMapCount" class="map-empty">
      Cette année, {{ events.length > 1 ? 'les événements se sont déroulés' : "l'événement s'est déroulé" }} hors de l'archipel.
    </div>
  </div>
</template>
