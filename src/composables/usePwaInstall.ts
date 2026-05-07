import { computed, onMounted, onUnmounted, ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface NavigatorWithStandalone extends Navigator {
    standalone?: boolean
}

export function usePwaInstall() {
    const installPrompt = ref<BeforeInstallPromptEvent | null>(null)
    const isInstalled = ref(false)

    const canInstall = computed(() => installPrompt.value !== null && !isInstalled.value)

    function updateInstalledState() {
        isInstalled.value = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as NavigatorWithStandalone).standalone === true
    }

    function handleBeforeInstallPrompt(event: Event) {
        event.preventDefault()
        installPrompt.value = event as BeforeInstallPromptEvent
    }

    function handleAppInstalled() {
        installPrompt.value = null
        isInstalled.value = true
    }

    async function installApp() {
        if (!installPrompt.value) {
            return
        }

        const prompt = installPrompt.value
        installPrompt.value = null

        await prompt.prompt()
        const choice = await prompt.userChoice

        if (choice.outcome !== 'accepted') {
            installPrompt.value = prompt
        }
    }

    onMounted(() => {
        updateInstalledState()
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        window.addEventListener('appinstalled', handleAppInstalled)
    })

    onUnmounted(() => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        window.removeEventListener('appinstalled', handleAppInstalled)
    })

    return {
        canInstall,
        installApp,
    }
}
