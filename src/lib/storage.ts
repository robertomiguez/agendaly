import { supabase } from "./supabase"
import { MAX_IMAGE_SIZE_BYTES } from "../constants"
import { optimizeImage } from "./imageCompression"

// Polyfill for crypto.randomUUID() to support all browsers, especially mobile
function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    // Fallback UUID v4 implementation for browsers without crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

/**
 * Generic image upload to a specified bucket.
 * Uses the userId (auth_user_id) as the top-level folder for RLS consistency.
 */
export async function uploadImage(bucket: string, userId: string, file: File) {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        const mb = MAX_IMAGE_SIZE_BYTES / (1024 * 1024)
        throw new Error(`File size exceeds ${mb}MB limit.`)
    }

    // Optimize image before upload (Resizing, WebP, Compression)
    const optimizedFile = await optimizeImage(file)

    const ext = optimizedFile.name.split('.').pop()
    const path = `${userId}/${generateUUID()}.${ext}`

    const { error } = await supabase.storage
        .from(bucket)
        .upload(path, optimizedFile, { upsert: false })

    if (error) throw error

    const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(path)

    return {
        url: data.publicUrl,
        path
    }
}

/**
 * Generic image delete from a specified bucket.
 */
export async function deleteImage(bucket: string, path?: string | null) {
    if (!path) return

    const { error } = await supabase.storage
        .from(bucket)
        .remove([path])

    if (error) {
        console.warn(`Failed to delete image from ${bucket}:`, error)
    }
}

