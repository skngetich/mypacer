<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import HoldButton from '../components/HoldButton.vue'
import SplitsTable from '../components/SplitsTable.vue'
import TapLock from '../components/TapLock.vue'
import { displayPace, formatDistance, formatDuration } from '../core/pace'
import type { RunRecord } from '../core/run'
import { clearCurrent, getCurrent, saveRun } from '../services/db'
import { isNative } from '../services/platform'
import { speechSupported } from '../services/speech'
import { wakeLockSupported } from '../services/wakelock'
import { announceNow, pause, resume, session, start, stop } from '../run/session'

const router = useRouter()
const locked = ref(false)
const recovered = ref<RunRecord | null>(null)

onMounted(async () => {
  if (session.phase === 'idle') recovered.value = (await getCurrent()) ?? null
})

async function keepRecovered() {
  await saveRun(recovered.value!)
  await clearCurrent()
  const id = recovered.value!.id
  recovered.value = null
  router.push(`/history/${id}`)
}

async function discardRecovered() {
  await clearCurrent()
  recovered.value = null
}

function onStart() {
  recovered.value = null
  start()
}

async function onStop() {
  locked.value = false
  const id = await stop()
  if (id) router.push(`/history/${id}`)
}
</script>

<template>
  <div class="run">
    <div v-if="recovered" class="banner">
      Found an unfinished run ({{ formatDistance(recovered.distance, recovered.unit) }} {{ recovered.unit }}).
      <div class="row" style="margin-top: 10px">
        <button class="primary" @click="keepRecovered">Save it</button>
        <button @click="discardRecovered">Discard</button>
      </div>
    </div>
    <div v-if="session.error" class="banner error">{{ session.error }}</div>
    <div v-if="session.gapNotice" class="banner" @click="session.gapNotice = false">
      The app was in the background, so GPS was paused. The gap is filled with a straight line. Keep MyPacer on screen while running. (Tap to dismiss)
    </div>
    <p v-if="session.phase === 'idle' && isNative" class="muted hint">
      You can lock your phone during a run. MyPacer keeps tracking and talking.
    </p>
    <div v-else-if="session.phase === 'idle' && !wakeLockSupported" class="banner">
      This browser can't keep the screen on. Set your phone's auto-lock to "Never" while running.
    </div>
    <div v-if="!speechSupported" class="banner error">This browser can't speak, so you won't hear voice updates.</div>

    <div class="status muted">
      <span v-if="session.simulated" class="sim">SIMULATED GPS</span>
      <span v-if="session.phase === 'acquiring'">Waiting for GPS<template v-if="session.gpsAccuracy"> (±{{ Math.round(session.gpsAccuracy) }} m)</template>…</span>
      <span v-else-if="session.phase === 'paused'" class="paused">{{ session.autoPaused ? 'AUTO-PAUSED' : 'PAUSED' }}</span>
      <span v-else-if="session.phase === 'running' && session.gpsAccuracy">GPS ±{{ Math.round(session.gpsAccuracy) }} m</span>
    </div>

    <button class="pace-tap" aria-label="Hear current pace" @click="announceNow">
      <span class="pace">{{ displayPace(session.pace, session.unit) }}</span>
      <span class="muted">current pace /{{ session.unit }} · tap to hear</span>
    </button>

    <div class="stats">
      <div>
        <div class="big">{{ formatDistance(session.distance, session.unit) }}</div>
        <div class="muted">{{ session.unit }}</div>
      </div>
      <div>
        <div class="big">{{ formatDuration(session.elapsed) }}</div>
        <div class="muted">time</div>
      </div>
      <div>
        <div class="big">{{ displayPace(session.avgPace, session.unit) }}</div>
        <div class="muted">avg /{{ session.unit }}</div>
      </div>
    </div>

    <div class="controls">
      <button v-if="session.phase === 'idle'" class="primary start" @click="onStart">Start</button>
      <template v-else>
        <button v-if="session.phase === 'acquiring'" @click="onStop">Cancel</button>
        <button v-else-if="session.phase === 'paused'" class="primary" @click="resume">Resume</button>
        <button v-else @click="pause">Pause</button>
        <HoldButton v-if="session.phase !== 'acquiring'" class="danger" @done="onStop">Hold to stop</HoldButton>
        <button v-if="session.phase !== 'acquiring'" class="lock-btn" aria-label="Lock screen" @click="locked = true">🔒</button>
      </template>
    </div>

    <p v-if="session.lastSpoken" class="muted said">🔊 “{{ session.lastSpoken }}”</p>

    <SplitsTable v-if="session.splits.length" :splits="session.splits" :unit="session.unit" />

    <TapLock v-if="locked && session.phase !== 'idle'" @unlock="locked = false" />
  </div>
</template>

<style scoped>
.run {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.status {
  min-height: 1.4em;
  display: flex;
  gap: 10px;
  justify-content: center;
  font-weight: 600;
}
.sim {
  color: var(--warn);
}
.paused {
  color: var(--warn);
}
.pace-tap {
  background: none;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.pace {
  font-size: clamp(4.5rem, 26vw, 8rem);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  text-align: center;
}
.big {
  font-size: 1.7rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.controls {
  display: flex;
  gap: 12px;
}
.controls > * {
  flex: 1;
  min-height: 64px;
  font-size: 1.15rem;
}
.controls .lock-btn {
  flex: 0 0 64px;
}
.start {
  min-height: 80px;
  font-size: 1.5rem;
}
.said,
.hint {
  text-align: center;
  margin: 0;
}
</style>
