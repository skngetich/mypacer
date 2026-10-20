<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import HoldButton from '../components/HoldButton.vue'
import RouteSvg from '../components/RouteSvg.vue'
import SplitsTable from '../components/SplitsTable.vue'
import { runName, toGpx } from '../core/gpx'
import { averagePace, displayPace, formatDistance, formatDuration } from '../core/pace'
import type { RunRecord } from '../core/run'
import { deleteRun, getRun } from '../services/db'

const props = defineProps<{ id: string }>()
const router = useRouter()
const run = ref<RunRecord | null>(null)
const missing = ref(false)

onMounted(async () => {
  run.value = (await getRun(props.id)) ?? null
  missing.value = !run.value
})

async function exportGpx() {
  const r = run.value!
  const name = `${runName(r)}.gpx`
  const file = new File([toGpx(r)], name, { type: 'application/gpx+xml' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: runName(r) })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function remove() {
  await deleteRun(props.id)
  router.replace('/history')
}
</script>

<template>
  <p v-if="missing" class="muted">Run not found.</p>
  <template v-if="run">
    <RouterLink to="/history" class="muted back">‹ History</RouterLink>
    <h1>{{ new Date(run.startedAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' }) }}</h1>
    <div class="card stats">
      <div>
        <div class="big">{{ formatDistance(run.distance, run.unit) }}</div>
        <div class="muted">{{ run.unit }}</div>
      </div>
      <div>
        <div class="big">{{ formatDuration(run.activeMs) }}</div>
        <div class="muted">moving time</div>
      </div>
      <div>
        <div class="big">{{ displayPace(averagePace(run.activeMs, run.distance), run.unit) }}</div>
        <div class="muted">avg /{{ run.unit }}</div>
      </div>
    </div>
    <div class="card"><RouteSvg :points="run.points" /></div>
    <div v-if="run.splits.length" class="card"><SplitsTable :splits="run.splits" :unit="run.unit" /></div>
    <div class="row">
      <button class="primary" @click="exportGpx">Export GPX</button>
      <HoldButton class="danger" @done="remove">Hold to delete</HoldButton>
    </div>
  </template>
</template>

<style scoped>
.back {
  display: inline-block;
  margin-bottom: 8px;
  text-decoration: none;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  text-align: center;
}
.big {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
