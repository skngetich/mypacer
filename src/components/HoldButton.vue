<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{ holdMs?: number }>(), { holdMs: 800 })
const emit = defineEmits<{ done: [] }>()

const holding = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function down() {
  holding.value = true
  timer = setTimeout(() => {
    holding.value = false
    emit('done')
  }, props.holdMs)
}

function up() {
  holding.value = false
  if (timer) clearTimeout(timer)
  timer = null
}

onBeforeUnmount(up)
</script>

<template>
  <button
    class="hold"
    :class="{ holding }"
    :style="{ '--hold-ms': `${holdMs}ms` }"
    @pointerdown="down"
    @pointerup="up"
    @pointerleave="up"
    @pointercancel="up"
    @contextmenu.prevent
  >
    <span class="fill" />
    <span class="label"><slot /></span>
  </button>
</template>

<style scoped>
.hold {
  position: relative;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}
.fill {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.25);
  transform: scaleX(0);
  transform-origin: left;
}
.holding .fill {
  transform: scaleX(1);
  transition: transform var(--hold-ms) linear;
}
.label {
  position: relative;
}
</style>
