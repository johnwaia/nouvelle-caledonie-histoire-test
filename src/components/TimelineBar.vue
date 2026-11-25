<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { yearLabel } from '../utils/dates'

/*
 * Frise en carrousel : un élément par année contenant au moins un événement.
 * L'année sélectionnée est centrée et mise en avant ; faire défiler le carrousel
 * (molette, glisser, doigt) sélectionne l'année qui s'arrête au centre.
 */
const props = defineProps({
  years: { type: Array, default: () => [] }, // [{ year, count }], triés, jamais vides
  selectedYear: { type: Number, default: null },
})
const emit = defineEmits(['select-year'])

const track = ref(null)
const dragging = ref(false)

const index = computed(() => props.years.findIndex((y) => y.year === props.selectedYear))

/* ---------- Sélection ---------- */
function selectAt(i) {
  const y = props.years[Math.max(0, Math.min(props.years.length - 1, i))]
  if (y && y.year !== props.selectedYear) emit('select-year', y.year)
}
const step = (delta) => selectAt(index.value + delta)
function onItemClick(year) {
  if (suppressClick) return
  if (year === props.selectedYear) centerActive()
  else emit('select-year', year)
}

/* ---------- Centrage ---------- */
// Défilement déclenché par le code : tant qu'il n'a pas atteint sa cible, il ne doit pas
// être pris pour un défilement de l'utilisateur (qui changerait l'année sélectionnée).
let programmatic = null // { left, until }
function centerActive(behavior = 'smooth') {
  const el = track.value
  const item = el?.querySelector('.yc-item.active')
  if (!item) return
  const max = el.scrollWidth - el.clientWidth
  const left = Math.max(0, Math.min(max, item.offsetLeft + item.offsetWidth / 2 - el.clientWidth / 2))
  if (Math.abs(el.scrollLeft - left) < 1) return
  programmatic = { left, until: performance.now() + 3000 }
  el.scrollTo({ left, behavior })
}

watch(() => props.selectedYear, () => nextTick(() => centerActive()))
watch(() => props.years, () => nextTick(() => centerActive('auto')))

// Quand le défilement s'arrête, l'année au centre devient l'année sélectionnée.
let settleTimer = 0
function onScroll() {
  clearTimeout(settleTimer)
  settleTimer = setTimeout(onSettle, 140)
}
function onSettle() {
  if (dragging.value) return
  const el = track.value
  if (programmatic) {
    const arrived = Math.abs(el.scrollLeft - programmatic.left) <= 2
    if (arrived || performance.now() > programmatic.until) programmatic = null
    if (arrived) return
    if (programmatic) {
      // Pas encore arrivé (animation interrompue ou ralentie) : on relance vers la cible.
      el.scrollTo({ left: programmatic.left, behavior: 'smooth' })
      return
    }
  }
  const center = el.scrollLeft + el.clientWidth / 2
  let best = -1
  let bestDist = Infinity
  el.querySelectorAll('.yc-item').forEach((node, i) => {
    const d = Math.abs(node.offsetLeft + node.offsetWidth / 2 - center)
    if (d < bestDist) [best, bestDist] = [i, d]
  })
  if (best === -1) return
  if (best === index.value) centerActive()
  else selectAt(best)
}

/* ---------- Molette : une année par cran ---------- */
let wheelAcc = 0
let wheelLock = 0
function onWheel(e) {
  programmatic = null
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return // défilement horizontal natif (pavé tactile)
  e.preventDefault()
  wheelAcc += e.deltaY
  const now = performance.now()
  if (Math.abs(wheelAcc) < 40 || now < wheelLock) return
  step(wheelAcc > 0 ? 1 : -1)
  wheelAcc = 0
  wheelLock = now + 140
}

/* ---------- Glisser à la souris (le tactile utilise le défilement natif) ---------- */
let drag = null
let suppressClick = false
function onPointerDown(e) {
  programmatic = null // l'utilisateur reprend la main
  if (e.pointerType !== 'mouse' || e.button !== 0) return
  drag = { x: e.clientX, left: track.value.scrollLeft, id: e.pointerId, moved: false }
}
function onPointerMove(e) {
  if (!drag) return
  const dx = e.clientX - drag.x
  if (!drag.moved && Math.abs(dx) > 5) {
    drag.moved = true
    dragging.value = true
    track.value.setPointerCapture(drag.id)
  }
  if (drag.moved) track.value.scrollLeft = drag.left - dx
}
function onPointerUp() {
  if (drag?.moved) {
    suppressClick = true
    setTimeout(() => (suppressClick = false), 0)
    dragging.value = false
    programmatic = null
    onSettle()
  }
  drag = null
}

let resizeObserver
onMounted(() => {
  nextTick(() => centerActive('auto'))
  resizeObserver = new ResizeObserver(() => centerActive('auto'))
  resizeObserver.observe(track.value)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  clearTimeout(settleTimer)
})
</script>

<template>
  <section class="timeline" aria-label="Frise chronologique">
    <div class="yc">
      <label class="yc-pick">
        <span>Choisir l'année</span>
        <select :value="selectedYear" @change="emit('select-year', Number($event.target.value))">
          <option v-for="y in years" :key="y.year" :value="y.year">{{ yearLabel(y.year) }}</option>
        </select>
      </label>
      <button class="yc-arrow" title="Année précédente (←)" aria-label="Année précédente" :disabled="index <= 0" @click="step(-1)">‹</button>
      <ol
        ref="track"
        class="yc-track"
        :class="{ dragging }"
        @scroll.passive="onScroll"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <li class="yc-spacer" aria-hidden="true"></li>
        <li v-for="y in years" :key="y.year">
          <button
            class="yc-item"
            :class="{ active: y.year === selectedYear }"
            :aria-current="y.year === selectedYear ? 'true' : undefined"
            :aria-label="yearLabel(y.year)"
            @click="onItemClick(y.year)"
          >
            <span class="yc-year">{{ y.year < 0 ? -y.year : yearLabel(y.year) }}<small v-if="y.year < 0">av. J.-C.</small></span>
          </button>
        </li>
        <li class="yc-spacer" aria-hidden="true"></li>
      </ol>
      <button class="yc-arrow" title="Année suivante (→)" aria-label="Année suivante" :disabled="index >= years.length - 1" @click="step(1)">›</button>
    </div>
  </section>
</template>
