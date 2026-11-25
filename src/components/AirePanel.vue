<script setup>
import { ref, onMounted } from 'vue'

defineProps({
  aire: { type: Object, required: true }, // { id, nom, couleur, description }
  communes: { type: Array, default: () => [] },
  tribuCount: { type: Number, default: 0 },
})
const emit = defineEmits(['close', 'select-commune'])

const closeBtn = ref(null)
onMounted(() => closeBtn.value?.focus())
</script>

<template>
  <!-- Fermeture : croix, clic à l'extérieur du panneau ou touche Échap -->
  <div class="tribu-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <dialog open class="tribu-panel" aria-modal="true" aria-labelledby="aire-title">
      <button ref="closeBtn" class="tribu-close" aria-label="Fermer" @click="emit('close')">×</button>

      <header class="tribu-head">
        <span class="commune-badge" :style="{ background: aire.couleur }" aria-hidden="true">{{ aire.nom.slice(0, 1) }}</span>
        <div>
          <p class="tribu-kicker">Aire coutumière</p>
          <h2 id="aire-title">{{ aire.nom }}</h2>
        </div>
      </header>

      <dl class="meta">
        <div><dt>Communes</dt><dd>{{ communes.length }}</dd></div>
        <div v-if="tribuCount"><dt>Tribus</dt><dd>{{ tribuCount }}</dd></div>
      </dl>

      <section class="tribu-section">
        <h3>Présentation</h3>
        <p>{{ aire.description }}</p>
        <p>
          La Nouvelle-Calédonie compte huit aires coutumières. Chacune a son conseil coutumier et désigne deux
          représentants au Sénat coutumier.
        </p>
      </section>

      <section v-if="communes.length" class="tribu-section">
        <h3>Communes de l'aire</h3>
        <ul class="aire-communes">
          <li v-for="c in communes" :key="c.id">
            <button type="button" @click="emit('select-commune', c.id)">{{ c.nom }}</button>
          </li>
        </ul>
      </section>

      <section class="sources">
        <h3>Sources</h3>
        <ul>
          <li>Contours : Gouvernement de la Nouvelle-Calédonie (Géorep), Licence Ouverte</li>
          <li>
            <a href="https://fr.wikipedia.org/w/index.php?search=Aires+coutumi%C3%A8res+de+Nouvelle-Cal%C3%A9donie" target="_blank" rel="noopener noreferrer">
              Aires coutumières de Nouvelle-Calédonie (Wikipédia)
            </a>
          </li>
        </ul>
      </section>
    </dialog>
  </div>
</template>
