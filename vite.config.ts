/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// TARGET=native builds the bundle for the Capacitor app: served from the app root, no service worker.
const native = process.env.TARGET === 'native'

export default defineConfig({
  base: native ? '/' : (process.env.BASE_PATH ?? '/mypacer/'),
  plugins: [
    vue(),
    VitePWA({
      disable: native,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MyPacer',
        short_name: 'MyPacer',
        description: 'Hear your running pace by voice',
        theme_color: '#0b0d10',
        background_color: '#0b0d10',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
