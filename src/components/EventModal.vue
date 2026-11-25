<script setup>
import { computed, ref, onMounted } from 'vue'
import CategoryIcon from './CategoryIcon.vue'

const props = defineProps({
  event: { type: Object, required: true },
  color: { type: String, default: '#555' }, // couleur de la catégorie (logo)
})
const emit = defineEmits(['close'])

const dialog = ref(null)
onMounted(() => dialog.value?.focus())

const paragraphs = computed(() => String(props.event.description || '').split(/\n\s*\n/).filter(Boolean))
const videos = computed(() => (props.event.videos || []).filter((v) => v?.url))
</script>

<template>
  <!-- Fermeture : bouton ×, clic à côté de la fiche ou touche Échap -->
  <div class="modal-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <dialog open ref="dialog" class="modal" aria-modal="true" aria-labelledby="ev-title" tabindex="-1">
      <button class="modal-close" aria-label="Fermer" title="Fermer (Échap)" @click="emit('close')">×</button>

      <figure v-if="event.image?.url" class="modal-figure">
        <div class="modal-frame" :style="{ '--img': `url(&quot;${event.image.url}&quot;)` }">
          <img :src="event.image.url" :alt="event.image.alt || event.title" />
        </div>
        <figcaption v-if="event.image.credit">
          <a v-if="event.image.source" :href="event.image.source" target="_blank" rel="noopener noreferrer">{{ event.image.credit }}</a>
          <template v-else>{{ event.image.credit }}</template>
        </figcaption>
      </figure>

      <div class="modal-body">
        <div class="ev-head">
          <img v-if="event.logo" class="ev-logo ev-logo-img" :src="event.logo" alt="" />
          <span v-else class="ev-logo" :style="{ '--c': color }"><CategoryIcon :category="event.category" /></span>
          <h2 id="ev-title">{{ event.title }}</h2>
        </div>
        <dl class="meta">
          <div><dt>Date</dt><dd class="cap">{{ event.dateText }}</dd></div>
          <div><dt>Lieu</dt><dd>{{ event.place }}</dd></div>
        </dl>
        <p v-for="(para, i) in paragraphs" :key="i">{{ para }}</p>

        <section v-if="videos.length" class="sources videos">
          <h3>Vidéos</h3>
          <ul>
            <li v-for="(v, i) in videos" :key="i">
              <a :href="v.url" target="_blank" rel="noopener noreferrer">▶ {{ v.label || v.url }}</a>
            </li>
          </ul>
        </section>

        <section v-if="event.sources?.length" class="sources">
          <h3>Sources et pour aller plus loin</h3>
          <ul>
            <li v-for="(s, i) in event.sources" :key="i">
              <a v-if="s.url" :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.label }}</a>
              <span v-else>{{ s.label }}</span>
            </li>
          </ul>
        </section>
      </div>
    </dialog>
  </div>
</template>
