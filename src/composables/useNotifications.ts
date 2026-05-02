import { ref } from 'vue'

export function useNotifications() {
    const successMessage = ref<string | null>(null)
    const errorMessage = ref<string | null>(null)

    function showSuccess(message: string) {
        successMessage.value = message
        errorMessage.value = null
        // Optional: auto-clear after some time
        setTimeout(() => {
            successMessage.value = null
        }, 5000)
    }

    function showError(message: string) {
        errorMessage.value = message
        successMessage.value = null
        // Optional: auto-clear after some time
        setTimeout(() => {
            errorMessage.value = null
        }, 10000)
    }

    function clearMessages() {
        successMessage.value = null
        errorMessage.value = null
    }

    return {
        successMessage,
        errorMessage,
        showSuccess,
        showError,
        clearMessages
    }
}
