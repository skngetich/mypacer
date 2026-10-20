<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { announceNow, session } from '../run/session'
import { displayPace, formatDistance, formatDuration } from '../core/pace'

const emit = defineEmits<{ unlock: [] }>()

const UNLOCK_MS = 1200
const holding = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let unlocked = false

function down() {
  holding.value = true
  unlocked = false
  timer = setTimeout(() => {
    unlocked = true
    holding.value = false
    emit('unlock')
  }, UNLOCK_MS)
}

function up() {
  if (timer) clearTimeout(timer)
  timer = null
  // A quick tap (not a completed hold) asks for the pace.
  if (holding.value && !unlocked) announceNow()
  holding.value = false
}

function cancel() {
  if (timer) clearTimeout(timer)
  holding.value = false
}

onBeforeUnmount(cancel)
</script>

<template>
  <div class="lock" @pointerdown="down" @pointerup="up" @pointercancel="cancel" @contextmenu.prevent>
    <div class="pace">{{ displayPace(session.pace, session.unit) }}</div>
    <div class="muted">{{ formatDistance(session.distance, session.unit) }} {{ session.unit }} · {{ formatDuration(session.elapsed) }}</div>
    <div v-if="session.phase === 'paused'" class="paused">PAUSED</div>
    <p class="hint" :class="{ holding }">Tap to hear pace · Hold to unlock</p>
  </div>
</template>

<style scoped>
.lock {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.pace {
  font-size: 5rem;
  font-weight: 800;
  color: #666;
  font-variant-numeric: tabular-nums;
}
.paused {
  color: var(--warn);
  font-weight: 700;
}
.hint {
  position: absolute;
  bottom: 48px;
  color: #444;
}
.hint.holding {
  color: var(--accent);
}
</style>
