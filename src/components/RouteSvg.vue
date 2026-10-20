<script setup lang="ts">
import { computed } from 'vue'
import type { TrackPoint } from '../core/tracker'

const props = defineProps<{ points: TrackPoint[] }>()

const SIZE = 300
const PAD = 12

/** Equirectangular projection fitted into a square; plenty for a run-sized area. */
const paths = computed(() => {
  const pts = props.points
  if (pts.length < 2) return []
  const k = Math.cos((pts[0].lat * Math.PI) / 180)
  const xs = pts.map((p) => p.lon * k)
  const ys = pts.map((p) => -p.lat)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const w = Math.max(...xs) - minX
  const h = Math.max(...ys) - minY
  const scale = (SIZE - 2 * PAD) / (Math.max(w, h) || 1)
  const offX = (SIZE - w * scale) / 2
  const offY = (SIZE - h * scale) / 2
  const segs = new Map<number, string[]>()
  pts.forEach((p, i) => {
    const xy = `${(offX + (xs[i] - minX) * scale).toFixed(1)},${(offY + (ys[i] - minY) * scale).toFixed(1)}`
    if (!segs.has(p.seg)) segs.set(p.seg, [])
    segs.get(p.seg)!.push(xy)
  })
  return [...segs.values()].map((s) => `M${s.join('L')}`)
})
</script>

<template>
  <svg v-if="paths.length" :viewBox="`0 0 ${SIZE} ${SIZE}`" class="route" role="img" aria-label="Route">
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>

<style scoped>
.route {
  width: 100%;
  max-height: 260px;
  display: block;
}
path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 3;
  stroke-linejoin: round;
  stroke-linecap: round;
}
</style>
