<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { averagePace, displayPace, formatDistance, formatDuration } from '../core/pace'
import type { RunRecord } from '../core/run'
import { listRuns } from '../services/db'
import { settings } from '../services/settings'

const runs = ref<RunRecord[] | null>(null)

onMounted(async () => {
  runs.value = await listRuns()
})

const when = (t: number) =>
  new Date(t).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <h1>History</h1>
  <p v-if="runs && !runs.length" class="muted">No runs yet. Your finished runs will show up here.</p>
  <RouterLink v-for="r in runs" :key="r.id" :to="`/history/${r.id}`" class="card run">
    <div class="muted">{{ when(r.startedAt) }}</div>
    <div class="nums">
      <span><b>{{ formatDistance(r.distance, settings.unit) }}</b> {{ settings.unit }}</span>
      <span>{{ formatDuration(r.activeMs) }}</span>
      <span>{{ displayPace(averagePace(r.activeMs, r.distance), settings.unit) }} /{{ settings.unit }}</span>
    </div>
  </RouterLink>
</template>

<style scoped>
.run {
  display: block;
  color: inherit;
  text-decoration: none;
}
.nums {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}
</style>
