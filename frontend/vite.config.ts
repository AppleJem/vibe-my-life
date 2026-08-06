import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Pre-cache all built assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mp3}'],
        // Cache API responses with NetworkFirst strategy
        runtimeCaching: [
          {
            urlPattern: /^https?:.*\/api\/.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      manifest: {
        name: 'Vibe My Life',
        short_name: 'VML',
        description: 'Track your expenses and habits',
        theme_color: '#a855f7',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        // No start_url on purpose: iOS honours it and would force every
        // home-screen install to open '/'. Omitting it makes each install
        // launch from the page it was added on (Expenses vs. Habits).
        // Explicit `undefined` is required — vite-plugin-pwa injects
        // start_url: '/' by default if the key is absent entirely.
        start_url: undefined,
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
