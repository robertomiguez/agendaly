/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import packageJson from './package.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(packageJson.version)
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'ui-vendor': ['lucide-vue-next', '@headlessui/vue']
        }
      }
    }
  },
  server: {
    host: true
  }
})
