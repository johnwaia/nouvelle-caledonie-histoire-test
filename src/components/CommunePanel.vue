<script setup>
import { ref, computed, onMounted } from 'vue'
import PhotoFigure from './PhotoFigure.vue'

const props = defineProps({
  commune: { type: Object, required: true },
  tribus: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'select-tribu'])

const closeBtn = ref(null)
onMounted(() => closeBtn.value?.focus())

// Une ligne courte qui se termine par un point (« Époque précoloniale. ») est un sous-titre de Wikipédia.
const paragraphs = (text) =>
  String(text || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ text: p, title: p.length < 70 && /^[^.]+\.$/.test(p) }))
const histoire = computed(() => paragraphs(props.commune.histoireManuelle || props.commune.histoire))
const resume = computed(() => paragraphs(props.commune.resume))
</script>

<template>
  <!-- Fermeture : croix, clic à l'extérieur du panneau ou touche Échap -->
  <div class="tribu-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <dialog open class="tribu-panel" aria-modal="true" aria-labelledby="commune-title">
      <button ref="closeBtn" class="tribu-close" aria-label="Fermer" @click="emit('close')">×</button>

      <PhotoFigure :image="commune.image" :alt="commune.nom" />

      <header class="tribu-head">
        <span class="commune-badge" aria-hidden="true">{{ commune.nom.slice(0, 1) }}</span>
        <div>
          <p class="tribu-kicker">Commune</p>
          <h2 id="commune-title">{{ commune.nom }}</h2>
        </div>
      </header>

      <dl class="meta">
        <div><dt>Province</dt><dd>{{ commune.province }}</dd></div>
        <div><dt>Aire coutumière</dt><dd>{{ commune.aire }}</dd></div>
        <div v-if="tribus.length"><dt>Tribus</dt><dd>{{ tribus.length }}</dd></div>
      </dl>

      <section v-if="resume.length" class="tribu-section">
        <h3>Présentation</h3>
        <p v-for="(p, i) in resume" :key="i">{{ p.text }}</p>
      </section>

      <section v-if="tribus.length" class="tribu-section">
        <h3>Tribus de la commune</h3>
        <ul class="aire-communes">
          <li v-for="t in tribus" :key="t.id">
            <button type="button" @click="emit('select-tribu', t.id)">{{ t.nom }}</button>
          </li>
        </ul>
      </section>

      <section v-if="histoire.length" class="tribu-section">
        <h3>Histoire</h3>
        <template v-for="(p, i) in histoire" :key="i">
          <h4 v-if="p.title" class="commune-subtitle">{{ p.text.slice(0, -1) }}</h4>
          <p v-else>{{ p.text }}</p>
        </template>
      </section>
      <p v-else class="tribu-todo">L'histoire de cette commune n'est pas encore disponible.</p>

      <section class="sources">
        <h3>Sources et pour aller plus loin</h3>
        <ul>
          <li v-if="commune.wikipedia">
            <a :href="commune.wikipedia" target="_blank" rel="noopener noreferrer">{{ commune.nom }} (Wikipédia)</a>
            — extraits sous licence
            <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>
          </li>
          <li v-for="(s, i) in commune.sources || []" :key="i">
            <a v-if="s.url" :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.label }}</a>
            <span v-else>{{ s.label }}</span>
          </li>
        </ul>
      </section>
    </dialog>
  </div>
</template>
