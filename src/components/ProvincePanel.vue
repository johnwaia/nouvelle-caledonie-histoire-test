<script setup>
import { ref, onMounted } from 'vue'

defineProps({
  province: { type: Object, required: true }, // { id, nom, couleur, chefLieu, description }
  communes: { type: Array, default: () => [] },
  aires: { type: Array, default: () => [] }, // noms des aires coutumières présentes dans la province
  tribuCount: { type: Number, default: 0 },
})
const emit = defineEmits(['close', 'select-commune'])

const closeBtn = ref(null)
onMounted(() => closeBtn.value?.focus())
</script>

<template>
  <!-- Fermeture : croix, clic à l'extérieur du panneau ou touche Échap -->
  <div class="tribu-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <dialog open class="tribu-panel" aria-modal="true" aria-labelledby="province-title">
      <button ref="closeBtn" class="tribu-close" aria-label="Fermer" @click="emit('close')">×</button>

      <header class="tribu-head">
        <span class="commune-badge" :style="{ background: province.couleur }" aria-hidden="true">P</span>
        <div>
          <p class="tribu-kicker">Province</p>
          <h2 id="province-title">{{ province.nom }}</h2>
        </div>
      </header>

      <dl class="meta">
        <div><dt>Chef-lieu</dt><dd>{{ province.chefLieu }}</dd></div>
        <div><dt>Communes</dt><dd>{{ communes.length }}</dd></div>
        <div v-if="tribuCount"><dt>Tribus</dt><dd>{{ tribuCount }}</dd></div>
      </dl>

      <section class="tribu-section">
        <h3>Présentation</h3>
        <p>{{ province.description }}</p>
        <p>
          Les trois provinces ont été créées par les accords de Matignon-Oudinot (1988) ; les premières élections
          provinciales ont eu lieu en 1989. Chaque province est administrée par une assemblée élue, dont une partie
          des membres siège au Congrès de la Nouvelle-Calédonie.
        </p>
      </section>

      <section v-if="aires.length" class="tribu-section">
        <h3>Aires coutumières</h3>
        <p>{{ aires.join(' · ') }}</p>
      </section>

      <section v-if="communes.length" class="tribu-section">
        <h3>Communes de la province</h3>
        <ul class="aire-communes">
          <li v-for="c in communes" :key="c.id">
            <button type="button" @click="emit('select-commune', c.id)">{{ c.nom }}</button>
          </li>
        </ul>
      </section>

      <section class="sources">
        <h3>Sources</h3>
        <ul>
          <li>Contours : Gouvernement de la Nouvelle-Calédonie (Géorep, limites administratives), Licence Ouverte</li>
          <li>
            <a href="https://fr.wikipedia.org/w/index.php?search=Provinces+de+la+Nouvelle-Cal%C3%A9donie" target="_blank" rel="noopener noreferrer">
              Provinces de la Nouvelle-Calédonie (Wikipédia)
            </a>
          </li>
        </ul>
      </section>
    </dialog>
  </div>
</template>
