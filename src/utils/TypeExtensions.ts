// TypeExtensions.ts - Centralized type extensions for missing or incomplete browser APIs

// =======================================================================
// Canvas API Extensions
// =======================================================================

/**
 * Global module augmentation for CanvasRenderingContext2D to include textRendering property
 * This property is used for text rendering optimization but is not part of the standard Canvas API
 */
declare global {
  interface CanvasRenderingContext2D {
    textRendering?: string;
  }
}

// =======================================================================
// Internationalization API Extensions
// =======================================================================

/**
 * Global module augmentation for Intl.Segmenter API
 * This API is newer and may not be available in all TypeScript versions
 */
declare global {
  namespace Intl {
    interface Segmenter {
      segment(text: string): Iterable<{
        segment: string;
        index: number;
        isWordLike?: boolean;
      }>;
    }

    interface SegmenterConstructor {
      new (locale?: string, options?: { granularity?: 'grapheme' | 'word' | 'sentence' }): Segmenter;
    }

    const Segmenter: SegmenterConstructor;
  }
}

// =======================================================================
// Web Audio API Extensions
// =======================================================================

/**
 * Navigator extension for autoplay policy API
 * This API is newer and may not be available in all browsers
 */
export interface NavigatorWithAutoplay extends Navigator {
  getAutoplayPolicy?: (type: string) => string;
}

/**
 * Window extension for webkit-prefixed AudioContext
 * Used for backwards compatibility with older browsers
 */
export interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// =======================================================================
// Object Pool Type Extensions
// =======================================================================

/**
 * Type for WebGL object pool entries that may have null values during initialization
 */
export interface WebGLPoolEntry {
  texture: WebGLTexture | null;
  sampler: WebGLSampler | null;
  vertices: Float32Array;
  uvRegion: Float32Array;
  vertexColors: Uint32Array;
}

/**
 * Type for WebGPU object pool entries that may have null values during initialization
 */
export interface WebGPUPoolEntry {
  texture: GPUTexture | null;
  sampler: GPUSampler | null;
  vertices: Float32Array;
  uvRegion: Float32Array;
  vertexColors: Uint32Array;
}