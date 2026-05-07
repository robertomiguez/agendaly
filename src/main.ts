import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'
import { useAuthStore } from './stores/useAuthStore'
import i18n from './lib/i18n'
import { registerServiceWorker } from './lib/serviceWorker'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

app.config.errorHandler = (err, _instance, info) => {
    console.error('[Vue Error]', err)
    console.error('[Vue Error Info]', info)
}

registerServiceWorker()

// Initialize auth before mounting
const authStore = useAuthStore()
authStore.initialize()
    .then(() => {
        app.mount('#app')
    })
    .catch((error) => {
        console.error('[Main] Error during auth initialization:', error)
        // Mount app anyway to prevent blank screen
        app.mount('#app')
    })
