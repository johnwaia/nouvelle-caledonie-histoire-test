<script setup>
import { computed } from 'vue'
import { shapesFor, SVG_ATTRS } from '../utils/icons'

// Logo d'une catégorie d'événement, dessiné directement en SVG (sans v-html).
const props = defineProps({
  category: { type: String, default: '' },
})
const shapes = computed(() => shapesFor(props.category))
</script>

<template>
  <!-- Icône décorative : le titre de la fiche donne déjà l'information -->
  <svg v-bind="SVG_ATTRS" aria-hidden="true" focusable="false">
    <component :is="tag" v-for="([tag, attrs], i) in shapes" :key="i" v-bind="attrs" />
  </svg>
</template>
