import imageCompression from 'browser-image-compression'

export interface CompressionOptions {
  maxSizeMB?: number
  maxWidthOrHeight?: number
  useWebWorker?: boolean
  fileType?: string
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: 0.5, // Target size 500KB
  maxWidthOrHeight: 1080,
  useWebWorker: true,
  fileType: 'image/webp'
}

/**
 * Optimizes an image file using client-side compression and resizing.
 * Converts to WebP by default.
 */
export async function optimizeImage(file: File, options?: CompressionOptions): Promise<File> {
  const settings = { ...DEFAULT_OPTIONS, ...options }
  
  try {
    const compressedFile = await imageCompression(file, settings)
    
    // browser-image-compression returns a Blob/File. 
    // We ensure it has a correct name and type if converted to WebP.
    if (settings.fileType === 'image/webp' && !compressedFile.name.endsWith('.webp')) {
      const fileName = file.name.split('.').shift() + '.webp'
      return new File([compressedFile], fileName, { type: 'image/webp' })
    }
    
    return compressedFile as File
  } catch (error) {
    console.error('Image compression failed:', error)
    // Fallback to original file if compression fails
    return file
  }
}
