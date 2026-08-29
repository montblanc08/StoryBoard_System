/**
 * FrameForge OS Client-Side Media Compressor Engine
 * Master Specification Section 5 Implementation Ready
 * Performs in-browser high-definition proxy compression before network transit.
 */

export interface CompressionOptions {
  maxDimension?: number; // Default 2560px for storyboard/review plates
  quality?: number; // 0.85 - 0.90 high quality
  mimeType?: 'image/webp' | 'image/jpeg' | 'image/png';
}

export interface CompressedResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  hasAlpha: boolean;
  mimeType: string;
}

/**
 * Check if an image contains transparent pixels
 */
export function checkHasAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const imgData = ctx.getImageData(0, 0, Math.min(width, 100), Math.min(height, 100));
    const data = imgData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true;
      }
    }
  } catch (e) {
    // If CORS or error, default false
  }
  return false;
}

/**
 * Calculate scaled dimensions maintaining aspect ratio without upscaling
 */
export function calculateTargetDimensions(
  origW: number,
  origH: number,
  maxDim = 2560
): { width: number; height: number } {
  if (origW <= maxDim && origH <= maxDim) {
    return { width: origW, height: origH };
  }

  if (origW >= origH) {
    const w = maxDim;
    const h = Math.round((origH * maxDim) / origW);
    return { width: w, height: h };
  } else {
    const h = maxDim;
    const w = Math.round((origW * maxDim) / origH);
    return { width: w, height: h };
  }
}

/**
 * Compress an image file in-browser into an HD Review Proxy
 */
export async function compressImageInBrowser(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<CompressedResult> {
  const maxDim = options.maxDimension || 2560;
  const quality = options.quality ?? 0.88;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      const { width, height } = calculateTargetDimensions(origW, origH, maxDim);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Failed to create canvas 2D rendering context'));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const hasAlpha = checkHasAlpha(ctx, width, height);

      // If has transparency, preserve alpha using PNG/lossless WebP
      const targetMime = hasAlpha ? 'image/png' : options.mimeType || 'image/webp';

      canvas.toBlob(
        blob => {
          if (!blob) {
            return reject(new Error('Canvas blob generation failed'));
          }

          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              blob,
              dataUrl: reader.result as string,
              width,
              height,
              originalSize: file.size,
              compressedSize: blob.size,
              hasAlpha,
              mimeType: targetMime
            });
          };
          reader.readAsDataURL(blob);
        },
        targetMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for client-side compression'));
    };

    img.src = url;
  });
}
