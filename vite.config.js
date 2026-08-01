import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts', 'date-fns']
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/icon-maskable.svg'],
      // Register the service worker in dev too, so beforeinstallprompt fires
      // and the Install button is testable on localhost without a production build
      devOptions: { enabled: true, type: 'module', navigateFallback: 'index.html' },
      manifest: {
        id: '/',
        name: 'Monetra Expense Manager',
        short_name: 'Monetra',
        description: 'Offline-first personal finance and budget manager',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        start_url: '/',
        scope: '/',
        lang: 'en',
        orientation: 'any',
        categories: ['finance', 'productivity', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ],
        shortcuts: [
          { name: 'Add Transaction', short_name: 'Add', url: '/transactions?new=1', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Budgets', short_name: 'Budgets', url: '/budgets', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-api', networkTimeoutSeconds: 5, expiration: { maxEntries: 100, maxAgeSeconds: 86400 } }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\//i,
            handler: 'CacheFirst',
            options: { cacheName: 'supabase-storage', expiration: { maxEntries: 60, maxAgeSeconds: 604800 } }
          }
        ]
      }
    })
  ]
});
