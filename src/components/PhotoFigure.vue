<script setup>
// Image d'illustration d'un panneau (tribu, commune), avec son crédit.
defineProps({
  image: { type: Object, default: null },
  alt: { type: String, default: '' },
})
</script>

<template>
  <figure v-if="image?.url" class="panel-figure">
    <div class="modal-frame" :style="{ '--img': `url(&quot;${image.url}&quot;)` }">
      <img :src="image.url" :alt="image.alt || alt" loading="lazy" />
    </div>
    <figcaption v-if="image.credit">
      <a v-if="image.source" :href="image.source" target="_blank" rel="noopener noreferrer">{{ image.credit }}</a>
      <template v-else>{{ image.credit }}</template>
    </figcaption>
  </figure>
</template>
