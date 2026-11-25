<script setup>
import { ref, computed, watch } from 'vue'

/*
 * Moteur de recherche : on choisit de chercher parmi les tribus ou les communes,
 * puis on sélectionne un résultat. La carte n'affiche alors que l'élément choisi.
 */
const props = defineProps({
  tribus: { type: Array, default: () => [] },
  communes: { type: Array, default: () => [] },
  focus: { type: Object, default: null }, // { type: 'tribu' | 'commune', id }
})
const emit = defineEmits(['choose', 'clear'])

const mode = ref('tribu')
const query = ref('')
const open = ref(false)
const active = ref(0)
const input = ref(null)

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const items = computed(() =>
  mode.value === 'tribu'
    ? props.tribus.map((t) => ({ id: t.id, label: t.nom, sub: [t.nomLocal, t.commune].filter(Boolean).join(' · '), keys: norm(`${t.nom} ${t.nomLocal || ''}`) }))
    : props.communes.map((c) => ({ id: c.id, label: c.nom, sub: `Province ${c.province === 'Îles Loyauté' ? 'des îles Loyauté' : c.province}`, keys: norm(c.nom) })),
)

// Les noms qui commencent par la recherche d'abord, puis ceux qui la contiennent.
const results = computed(() => {
  const q = norm(query.value)
  if (!q) return mode.value === 'commune' ? items.value : []
  const starts = []
  const contains = []
  for (const it of items.value) {
    if (it.keys.split(' ').some((w) => w.startsWith(q)) || it.keys.startsWith(q)) starts.push(it)
    else if (it.keys.includes(q)) contains.push(it)
  }
  const byLabel = (a, b) => a.label.localeCompare(b.label, 'fr')
  return [...starts.toSorted(byLabel), ...contains.toSorted(byLabel)].slice(0, 30)
})

const focusLabel = computed(() => {
  if (!props.focus) return ''
  const list = props.focus.type === 'tribu' ? props.tribus : props.communes
  const item = list.find((x) => x.id === props.focus.id)
  if (!item) return ''
  const kind = props.focus.type === 'tribu' ? 'Tribu' : 'Commune'
  return `${kind} : ${item.nom}`
})

watch([query, mode], () => (active.value = 0))
watch(mode, () => {
  query.value = ''
  open.value = true
  input.value?.focus()
})

function choose(it) {
  if (!it) return
  emit('choose', { type: mode.value, id: it.id })
  query.value = ''
  open.value = false
  input.value?.blur()
}
function onKeydown(e) {
  if (e.key === 'ArrowDown') {
    open.value = true
    active.value = Math.min(results.value.length - 1, active.value + 1)
  } else if (e.key === 'ArrowUp') {
    active.value = Math.max(0, active.value - 1)
  } else if (e.key === 'Enter') {
    choose(results.value[active.value])
  } else if (e.key === 'Escape') {
    open.value = false
    input.value?.blur()
  } else return
  e.preventDefault()
  e.stopPropagation()
}
// Laisse le temps au clic sur un résultat d'être pris en compte avant de fermer la liste.
const onBlur = () => setTimeout(() => (open.value = false), 150)
</script>

<template>
  <div class="search" role="search" @keydown.stop>
    <!-- Choix du type de recherche : vrais boutons radio, présentés comme deux onglets -->
    <fieldset class="search-modes">
      <legend class="visually-hidden">Rechercher parmi</legend>
      <label v-for="m in [{ v: 'tribu', l: 'Tribus' }, { v: 'commune', l: 'Communes' }]" :key="m.v" :class="{ on: mode === m.v }">
        <input v-model="mode" type="radio" name="search-mode" :value="m.v" />
        {{ m.l }}
      </label>
    </fieldset>

    <div class="search-field">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input
        ref="input"
        v-model="query"
        type="search"
        :placeholder="mode === 'tribu' ? `Rechercher une tribu (${tribus.length})…` : 'Rechercher une commune…'"
        :aria-label="mode === 'tribu' ? 'Rechercher une tribu' : 'Rechercher une commune'"
        aria-controls="search-results"
        autocomplete="off"
        @focus="open = true"
        @input="open = true"
        @blur="onBlur"
        @keydown="onKeydown"
      />
    </div>

    <!-- Résultats : une liste de boutons (flèches + Entrée depuis le champ, ou clic) -->
    <ul v-if="open && results.length" id="search-results" class="search-results">
      <li v-for="(it, i) in results" :key="it.id">
        <button
          type="button"
          tabindex="-1"
          :class="{ active: i === active }"
          :aria-current="i === active ? 'true' : undefined"
          @mousedown.prevent="choose(it)"
          @mouseenter="active = i"
        >
          <strong>{{ it.label }}</strong>
          <small v-if="it.sub">{{ it.sub }}</small>
        </button>
      </li>
    </ul>
    <p v-else-if="open && query && !results.length" class="search-empty">Aucun résultat</p>

    <div v-if="focusLabel" class="search-focus">
      <span>Affiché : <strong>{{ focusLabel }}</strong></span>
      <button type="button" aria-label="Tout réafficher" title="Tout réafficher" @click="emit('clear')">×</button>
    </div>
  </div>
</template>
