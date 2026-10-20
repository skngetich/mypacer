import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import RunView from './views/RunView.vue'
import './style.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: RunView },
    { path: '/history', component: () => import('./views/HistoryView.vue') },
    { path: '/history/:id', component: () => import('./views/RunDetailView.vue'), props: true },
    { path: '/settings', component: () => import('./views/SettingsView.vue') },
  ],
})

registerSW({ immediate: true })

createApp(App).use(router).mount('#app')
