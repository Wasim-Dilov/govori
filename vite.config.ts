import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from https://wasim-dilov.github.io/govori/ on GitHub Pages.
export default defineConfig({
  base: '/govori/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Only the Latin and Cyrillic font files are needed offline.
        globIgnores: ['**/*-arabic-*', '**/*-hebrew-*', '**/*-greek-*', '**/*-vietnamese-*'],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
      devOptions: { enabled: false },
      manifest: {
        name: 'Govori · Говори',
        short_name: 'Govori',
        description: 'Learn Bulgarian in small bursts: for her, for the kids, for the family.',
        lang: 'en',
        start_url: '/govori/',
        scope: '/govori/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fff8f4',
        theme_color: '#fff8f4',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
    }),
  ],
})
