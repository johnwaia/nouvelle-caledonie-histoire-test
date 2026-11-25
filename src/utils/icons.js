// Logos des événements, un par catégorie (icônes au trait, 24 × 24, couleur héritée).
// Chaque icône est une liste de formes SVG [balise, attributs] : elle est dessinée
// par le composant CategoryIcon.vue (fiches) ou convertie en texte pour la carte Leaflet.
export const CATEGORY_SHAPES = {
  // Pirogue à voile
  peuplement: [['path', { d: 'M3 16h18l-2.5 4h-13z' }], ['path', { d: 'M12 3v13' }], ['path', { d: 'M12 4l6 10h-6' }]],
  // Boussole
  contact: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M15.5 8.5l-2 5-5 2 2-5z' }]],
  // Drapeau planté
  colonisation: [['path', { d: 'M5 21V3' }], ['path', { d: 'M5 4h12l-2.5 4L17 12H5' }]],
  // Deux lances croisées
  conflit: [['path', { d: 'M4 20L18 6' }], ['path', { d: 'M15 4l5 0 0 5' }], ['path', { d: 'M20 20L6 6' }], ['path', { d: 'M4 9V4h5' }]],
  // Urne de vote
  politique: [['path', { d: 'M4 11h16v9H4z' }], ['path', { d: 'M9 11V5h6v6' }], ['path', { d: 'M8 15h8' }]],
  // Usine (nickel)
  economie: [['path', { d: 'M3 21V11l5 3v-3l5 3V5h4v16z' }], ['path', { d: 'M3 21h18' }]],
  // Case kanak
  culture: [['path', { d: 'M12 3L4 12h2v8h12v-8h2z' }], ['path', { d: 'M12 3v-1' }], ['path', { d: 'M10 20v-5h4v5' }]],
  // Feuille
  environnement: [['path', { d: 'M5 19c0-9 6-14 15-14 0 9-5 15-14 15' }], ['path', { d: 'M5 19l8-8' }]],
  // Croix de santé
  sante: [['path', { d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' }]],
}
const DEFAULT_SHAPES = [['circle', { cx: 12, cy: 12, r: 4 }]]

export const shapesFor = (category) => CATEGORY_SHAPES[category] || DEFAULT_SHAPES

export const SVG_ATTRS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
}

// Version texte pour les marqueurs Leaflet (données internes, aucune saisie d'utilisateur).
const attrs = (o) =>
  Object.entries(o)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')
export const iconFor = (category) =>
  `<svg ${attrs(SVG_ATTRS)}>${shapesFor(category)
    .map(([tag, a]) => `<${tag} ${attrs(a)}/>`)
    .join('')}</svg>`
