<script setup lang="ts">
import { session } from './run/session'
</script>

<template>
  <main class="page">
    <RouterView />
  </main>
  <nav class="tabs">
    <RouterLink to="/">{{ session.phase === 'idle' ? 'Run' : '● Run' }}</RouterLink>
    <RouterLink to="/history">History</RouterLink>
    <RouterLink to="/settings">Settings</RouterLink>
  </nav>
</template>
