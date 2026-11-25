<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import MapView from './components/MapView.vue'
import TimelineBar from './components/TimelineBar.vue'
import EventModal from './components/EventModal.vue'
import TribuPanel from './components/TribuPanel.vue'
import CommunePanel from './components/CommunePanel.vue'
import SearchBox from './components/SearchBox.vue'
import AirePanel from './components/AirePanel.vue'
import ProvincePanel from './components/ProvincePanel.vue'
import { loadDatabase } from './db/client'
import { parseDate, toDecimal, formatEventDate } from './utils/dates'

// Les images de la base sont publiées comme des fichiers du site (« images/evenements/… »).
const resolveUrl = (u) => (/^https?:\/\//.test(u) ? u : import.meta.env.BASE_URL + u.replace(/^\//, ''))

const loading = ref(true)
const error = ref('')
const categories = ref({})
const events = ref([])

const selectedYear = ref(null)
const caseIcon = import.meta.env.BASE_URL + 'images/case_kanak_icone.png'
const selectedId = ref(null)
const tribus = ref([])
const selectedTribuId = ref(null)
const showTribus = ref(false) // affichage des tribus : bouton dans l'en-tête, indépendant des années
const communes = ref([])
const selectedCommuneId = ref(null)
const showCommunes = ref(false)
// Résultat choisi dans le moteur de recherche : la carte n'affiche alors que lui.
const focus = ref(null) // { type: 'tribu' | 'commune', id }
const aires = ref(null) // GeoJSON des aires coutumières
const showAires = ref(false)
const selectedAireId = ref(null)
const provinces = ref(null) // GeoJSON des provinces
const showProvinces = ref(false)
const selectedProvinceId = ref(null)

function normalize(raw) {
  const start = parseDate(raw.date)
  const t = toDecimal(start)
  if (!raw.id || Number.isNaN(t)) {
    console.warn('Événement ignoré (id ou date invalide) :', raw)
    return null
  }
  const tEnd = raw.endDate ? toDecimal(parseDate(raw.endDate)) : null
  return {
    ...raw,
    t,
    year: start.y,
    tEnd: Number.isNaN(tEnd) ? null : tEnd,
    coords: Array.isArray(raw.coords) && raw.coords.length === 2 ? raw.coords : null,
    dateText: formatEventDate(raw),
    sources: (raw.sources || []).map((s) => (typeof s === 'string' ? { label: s } : s)),
    videos: (raw.videos || []).map((v) => (typeof v === 'string' ? { url: v } : v)),
    // Image de la base (« images/evenements/… ») ou lien (https://…)
    image: raw.image?.url ? { ...raw.image, url: resolveUrl(raw.image.url) } : raw.image,
    // Logo illustré propre à l'événement (sinon, logo de sa catégorie)
    logo: raw.logo ? resolveUrl(raw.logo) : null,
  }
}

// Toutes les informations viennent de la base SQLite (database/kanaky.sqlite).
async function load() {
  try {
    const data = await loadDatabase()
    categories.value = data.categories
    events.value = data.events.map(normalize).filter(Boolean).sort((a, b) => a.t - b.t)
    tribus.value = data.tribus
    communes.value = data.communes.map((c) => (c.image ? { ...c, image: { ...c.image, url: resolveUrl(c.image.url) } } : c))
    aires.value = data.aires
    provinces.value = data.provinces
  } catch (e) {
    error.value = `Impossible de charger la base de données (${e.message}).`
  } finally {
    loading.value = false
  }
}

/* ---------- Années ---------- */

// Une entrée par année contenant au moins un événement.
const years = computed(() => {
  const counts = new Map()
  for (const e of events.value) counts.set(e.year, (counts.get(e.year) || 0) + 1)
  return [...counts].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year)
})
const visibleEvents = computed(() => events.value.filter((e) => e.year === selectedYear.value))

// Si l'année choisie n'existe plus (données rechargées), on passe à la plus proche.
watch(years, (list) => {
  if (!list.length || list.some((y) => y.year === selectedYear.value)) return
  const target = selectedYear.value ?? -Infinity
  selectedYear.value = list.reduce(
    (best, y) => (Math.abs(y.year - target) < Math.abs(best.year - target) ? y : best),
    list[0],
  ).year
})
const yearIndex = computed(() => years.value.findIndex((y) => y.year === selectedYear.value))
function stepYear(delta) {
  const y = years.value[Math.max(0, Math.min(years.value.length - 1, yearIndex.value + delta))]
  if (y) selectedYear.value = y.year
}

/* ---------- Tribus, communes et recherche ---------- */
// Sans recherche : les boutons de l'en-tête affichent toutes les tribus / communes.
// Avec un résultat de recherche : seul cet élément est affiché.
const visibleTribus = computed(() => {
  if (focus.value) return focus.value.type === 'tribu' ? tribus.value.filter((t) => t.id === focus.value.id) : []
  return showTribus.value ? tribus.value : []
})
const visibleCommunes = computed(() => {
  if (focus.value) return focus.value.type === 'commune' ? communes.value.filter((c) => c.id === focus.value.id) : []
  return showCommunes.value ? communes.value : []
})
const selectedTribu = computed(() => visibleTribus.value.find((t) => t.id === selectedTribuId.value) || null)
const selectedCommune = computed(() => visibleCommunes.value.find((c) => c.id === selectedCommuneId.value) || null)
const plainName = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const byName = (a, b) => a.nom.localeCompare(b.nom, 'fr')
const tribusOfCommune = (commune) => tribus.value.filter((t) => plainName(t.commune) === plainName(commune.nom)).sort(byName)
const focusTarget = computed(() => {
  if (!focus.value) return null
  const list = focus.value.type === 'tribu' ? tribus.value : communes.value
  const item = list.find((x) => x.id === focus.value.id)
  return item ? { coords: item.coords, zoom: focus.value.type === 'tribu' ? 11 : 9.5, key: focus.value.type + item.id } : null
})
watch([visibleTribus, visibleCommunes], () => {
  if (selectedTribuId.value && !selectedTribu.value) selectedTribuId.value = null
  if (selectedCommuneId.value && !selectedCommune.value) selectedCommuneId.value = null
})
// Ferme toutes les fiches (événement, tribu, commune, aire, province) avant d'en ouvrir une autre.
function clearSelections() {
  selectedId.value = null
  selectedTribuId.value = null
  selectedCommuneId.value = null
  selectedAireId.value = null
  selectedProvinceId.value = null
}
function selectTribu(id) {
  clearSelections()
  selectedTribuId.value = id
}
function selectCommune(id) {
  clearSelections()
  selectedCommuneId.value = id
}

/* ---------- Aires coutumières ---------- */
const aireList = computed(() => (aires.value?.features || []).map((f) => f.properties))
const selectedAire = computed(() => (showAires.value ? aireList.value.find((a) => a.id === selectedAireId.value) : null) || null)
const communesOfAire = (aire) => communes.value.filter((c) => plainName(c.aire) === plainName(aire.nom))
const tribusInAire = (aire) => tribus.value.filter((t) => plainName(t.aire) === plainName(aire.nom)).length
function selectAire(id) {
  clearSelections()
  selectedAireId.value = id
}
// Aires et provinces se superposeraient : afficher l'une masque l'autre.
function toggleZone(zone) {
  const next = !zone.value
  for (const z of [showAires, showProvinces]) z.value = false
  zone.value = next
}
const toggleAires = () => toggleZone(showAires)
const toggleProvinces = () => toggleZone(showProvinces)

/* ---------- Provinces ---------- */
const provinceList = computed(() => (provinces.value?.features || []).map((f) => f.properties))
const selectedProvince = computed(
  () => (showProvinces.value ? provinceList.value.find((p) => p.id === selectedProvinceId.value) : null) || null,
)
const communesOfProvince = (prov) => communes.value.filter((c) => c.province === prov.cle)
const tribusInProvince = (prov) => {
  const names = new Set(communesOfProvince(prov).map((c) => plainName(c.nom)))
  return tribus.value.filter((t) => names.has(plainName(t.commune))).length
}
const airesOfProvince = (prov) => [...new Set(communesOfProvince(prov).map((c) => c.aire).filter(Boolean))]
function selectProvince(id) {
  clearSelections()
  selectedProvinceId.value = id
}
watch(showAires, (v) => {
  if (!v) selectedAireId.value = null
})
watch(showProvinces, (v) => {
  if (!v) selectedProvinceId.value = null
})

// Depuis la fiche d'une commune : on montre la tribu choisie (comme une recherche).
function openTribu(id) {
  chooseFromSearch({ type: 'tribu', id })
}

// Depuis la fiche d'une aire ou d'une province : on montre la commune choisie (comme une recherche).
function openCommuneFromZone(id) {
  chooseFromSearch({ type: 'commune', id })
}
function chooseFromSearch(f) {
  focus.value = f
  if (f.type === 'tribu') selectTribu(f.id)
  else selectCommune(f.id)
}
function clearFocus() {
  focus.value = null
  selectedTribuId.value = null
  selectedCommuneId.value = null
}
// Les boutons de l'en-tête quittent le mode « un seul résultat ».
function toggleTribus() {
  focus.value = null
  showTribus.value = !showTribus.value
}
function toggleCommunes() {
  focus.value = null
  showCommunes.value = !showCommunes.value
}

/* ---------- Sélection & navigation ---------- */
const selected = computed(() => events.value.find((e) => e.id === selectedId.value) || null)
const selectedIndex = computed(() => events.value.findIndex((e) => e.id === selectedId.value))
const select = (id) => {
  clearSelections()
  selectedId.value = id
}
// L'année suit l'événement ouvert (lien partagé, Précédent/Suivant, encart hors archipel…).
watch(selected, (ev) => {
  if (ev) selectedYear.value = ev.year
})
const close = () => (selectedId.value = null)
function go(delta) {
  const next = events.value[selectedIndex.value + delta]
  if (next) selectedId.value = next.id
}

// Liens partageables : #evenement=<id>, #tribu=<id> ou #commune=<id>
function readHash() {
  const ev = /evenement=([^&]+)/.exec(location.hash)
  const tr = /tribu=([^&]+)/.exec(location.hash)
  const co = /commune=([^&]+)/.exec(location.hash)
  selectedId.value = ev ? decodeURIComponent(ev[1]) : null
  if (tr || co) focus.value = null // un lien partagé réaffiche tout (quitte le mode « un seul résultat »)
  if (tr) {
    showTribus.value = true // un lien vers une tribu active l'affichage des tribus
    selectTribu(decodeURIComponent(tr[1]))
  } else if (co) {
    showCommunes.value = true
    selectCommune(decodeURIComponent(co[1]))
  } else if (!ev) {
    selectedTribuId.value = null
    selectedCommuneId.value = null
  }
}
// Adresse partageable correspondant à ce qui est ouvert (événement, tribu ou commune).
function shareHash(id, tribuId, communeId) {
  if (id) return `#evenement=${encodeURIComponent(id)}`
  if (tribuId) return `#tribu=${encodeURIComponent(tribuId)}`
  if (communeId) return `#commune=${encodeURIComponent(communeId)}`
  return ''
}
watch([selectedId, selectedTribuId, selectedCommuneId], ([id, tribuId, communeId]) => {
  const hash = shareHash(id, tribuId, communeId)
  if (hash && location.hash !== hash) history.replaceState(null, '', hash)
  else if (!hash && location.hash) history.replaceState(null, '', location.pathname + location.search)
})

/* ---------- Clavier ---------- */
function closePanels() {
  selectedTribuId.value = null
  selectedCommuneId.value = null
  selectedAireId.value = null
  selectedProvinceId.value = null
}
const placePanelOpen = computed(
  () => !!(selectedTribu.value || selectedCommune.value || selectedAire.value || selectedProvince.value),
)
// Flèches : année précédente / suivante (sauf dans un champ ou sur la carte, où Leaflet les utilise).
const YEAR_KEYS = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }
function onYearKey(e) {
  if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select, .map')) return
  const delta = YEAR_KEYS[e.key]
  if (!delta) return
  e.preventDefault()
  stepYear(Number.isFinite(delta) ? delta : Math.sign(delta) * years.value.length)
}
// Dans une fiche d'événement : Échap ferme, les flèches passent à l'événement voisin.
const EVENT_KEYS = { Escape: () => close(), ArrowLeft: () => go(-1), ArrowRight: () => go(1) }

function onKey(e) {
  if (placePanelOpen.value) {
    if (e.key === 'Escape') closePanels()
  } else if (selected.value) {
    EVENT_KEYS[e.key]?.()
  } else {
    onYearKey(e)
  }
}

onMounted(async () => {
  await load()
  selectedYear.value = years.value[0]?.year ?? null
  readHash()
  window.addEventListener('hashchange', readHash)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', readHash)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <div class="brand">
        <h1>KANAKY</h1>
        <p>Une histoire en carte, des premiers peuplements à aujourd'hui</p>
      </div>
      <div class="header-actions">
        <button
          class="tribus-toggle"
          :class="{ on: showTribus }"
          :aria-pressed="showTribus"
          :disabled="!tribus.length"
          @click="toggleTribus"
        >
          <img :src="caseIcon" alt="" />
          <span class="long">{{ showTribus ? 'Masquer les tribus' : 'Afficher les tribus' }}</span>
          <span class="short">Tribus</span>
        </button>
        <button
          class="tribus-toggle"
          :class="{ on: showCommunes }"
          :aria-pressed="showCommunes"
          :disabled="!communes.length"
          @click="toggleCommunes"
        >
          <span class="commune-dot" aria-hidden="true"></span>
          <span class="long">{{ showCommunes ? 'Masquer les communes' : 'Afficher les communes' }}</span>
          <span class="short">Communes</span>
        </button>
        <button
          class="tribus-toggle"
          :class="{ on: showAires }"
          :aria-pressed="showAires"
          :disabled="!aires"
          @click="toggleAires"
        >
          <span class="aire-dot" aria-hidden="true"></span>
          <span class="long">{{ showAires ? 'Masquer les aires' : 'Afficher les aires coutumières' }}</span>
          <span class="short">Aires</span>
        </button>
        <button
          class="tribus-toggle"
          :class="{ on: showProvinces }"
          :aria-pressed="showProvinces"
          :disabled="!provinces"
          @click="toggleProvinces"
        >
          <span class="province-dot" aria-hidden="true"></span>
          <span class="long">{{ showProvinces ? 'Masquer les provinces' : 'Afficher les provinces' }}</span>
          <span class="short">Provinces</span>
        </button>
      </div>
    </header>

    <main class="app-map">
      <MapView
        :events="visibleEvents"
        :categories="categories"
        :selected-event="selected"
        :year="selectedYear"
        :tribus="visibleTribus"
        :selected-tribu-id="selectedTribuId"
        :communes="visibleCommunes"
        :selected-commune-id="selectedCommuneId"
        :focus-target="focusTarget"
        :aires="showAires ? aires : null"
        :selected-aire-id="selectedAireId"
        :provinces="showProvinces ? provinces : null"
        :land="provinces"
        :selected-province-id="selectedProvinceId"
        @select="select"
        @select-tribu="selectTribu"
        @select-commune="selectCommune"
        @select-aire="selectAire"
        @select-province="selectProvince"
      />
      <SearchBox
        v-if="!loading && !error"
        :tribus="tribus"
        :communes="communes"
        :focus="focus"
        @choose="chooseFromSearch"
        @clear="clearFocus"
      />
      <div v-if="loading" class="app-status">Chargement de la chronologie…</div>
      <div v-else-if="error" class="app-status error">{{ error }}</div>
    </main>

    <TimelineBar
      v-if="!loading && !error"
      :years="years"
      :selected-year="selectedYear"
      @select-year="selectedYear = $event"
    />

    <EventModal
      v-if="selected"
      :key="selected.id"
      :event="selected"
      :color="categories[selected.category]?.color"
      @close="close"
    />

    <TribuPanel
      v-if="selectedTribu"
      :key="selectedTribu.id"
      :tribu="selectedTribu"
      @close="selectedTribuId = null"
    />

    <CommunePanel
      v-if="selectedCommune"
      :key="selectedCommune.id"
      :commune="selectedCommune"
      :tribus="tribusOfCommune(selectedCommune)"
      @close="selectedCommuneId = null"
      @select-tribu="openTribu"
    />

    <AirePanel
      v-if="selectedAire"
      :key="selectedAire.id"
      :aire="selectedAire"
      :communes="communesOfAire(selectedAire)"
      :tribu-count="tribusInAire(selectedAire)"
      @close="selectedAireId = null"
      @select-commune="openCommuneFromZone"
    />

    <ProvincePanel
      v-if="selectedProvince"
      :key="selectedProvince.id"
      :province="selectedProvince"
      :communes="communesOfProvince(selectedProvince)"
      :aires="airesOfProvince(selectedProvince)"
      :tribu-count="tribusInProvince(selectedProvince)"
      @close="selectedProvinceId = null"
      @select-commune="openCommuneFromZone"
    />

  </div>
</template>
