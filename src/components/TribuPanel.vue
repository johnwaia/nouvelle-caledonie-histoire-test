<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  tribu: { type: Object, required: true },
})
const emit = defineEmits(['close'])

const closeBtn = ref(null)
onMounted(() => closeBtn.value?.focus())

const CASE_IMG = import.meta.env.BASE_URL + 'images/case_kanak_icone.png'
// « Ouvéa — Ouvéa (îles Loyauté) » → « Ouvéa (îles Loyauté) »
const localisation = computed(() => {
  const { commune = '', ile } = props.tribu
  if (!ile) return commune
  return ile.startsWith(commune) ? ile : `${commune} — ${ile}`
})
</script>

<template>
  <!-- Fermeture : croix, clic à l'extérieur du panneau ou touche Échap -->
  <div class="tribu-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <dialog open class="tribu-panel" aria-modal="true" aria-labelledby="tribu-title">
      <button ref="closeBtn" class="tribu-close" aria-label="Fermer" @click="emit('close')">×</button>

      <header class="tribu-head">
        <img :src="CASE_IMG" alt="" />
        <div>
          <p class="tribu-kicker">Tribu</p>
          <h2 id="tribu-title">{{ tribu.nom }}</h2>
          <p v-if="tribu.nomLocal && tribu.nomLocal !== tribu.nom" class="tribu-local">{{ tribu.nomLocal }}</p>
        </div>
      </header>

      <dl class="meta">
        <div><dt>Localisation</dt><dd>{{ localisation }}</dd></div>
        <div v-if="tribu.aire"><dt>Aire coutumière</dt><dd>{{ tribu.aire }}</dd></div>
      </dl>

      <section v-if="tribu.origines" class="tribu-section">
        <h3>Origines</h3>
        <p>{{ tribu.origines }}</p>
      </section>

      <section v-if="tribu.evenements?.length" class="tribu-section">
        <h3>Événements marquants</h3>
        <ol class="tribu-events">
          <li v-for="(ev, i) in tribu.evenements" :key="i">
            <strong>{{ ev.date }}</strong>
            <span>{{ ev.texte }}</span>
          </li>
        </ol>
      </section>

      <p v-if="!tribu.origines && !tribu.evenements?.length" class="tribu-todo">
        L'histoire de cette tribu n'a pas encore été rédigée. Elle peut être ajoutée dans
        l’administration du site (champs « origines », « evenements » et « sources »).
      </p>

      <section v-if="tribu.sources?.length" class="sources">
        <h3>Sources et pour aller plus loin</h3>
        <ul>
          <li v-for="(s, i) in tribu.sources" :key="i">
            <a v-if="s.url" :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.label }}</a>
            <span v-else>{{ s.label }}</span>
          </li>
        </ul>
      </section>
    </dialog>
  </div>
</template>
