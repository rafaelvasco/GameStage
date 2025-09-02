import { AudioContext } from "../../audio/AudioContext";
import { Logger } from "../../utils/Logger";

/**
 * High-performance audio loader with buffer caching and memory optimization.
 * 
 * Caches AudioBuffer objects for efficient reuse and manages loading
 * with proper error handling and memory management.
 */
export class AudioLoader {
  private static instance: AudioLoader | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private loadingPromises = new Map<string, Promise<AudioBuffer>>();
  private logger = Logger.getInstance();

  private constructor() {}

  static getInstance(): AudioLoader {
    if (!AudioLoader.instance) {
      AudioLoader.instance = new AudioLoader();
    }
    return AudioLoader.instance;
  }

  /**
   * Load an audio file and return cached AudioBuffer.
   * Prevents duplicate loading and optimizes memory usage.
   */
  async loadAudioBuffer(path: string): Promise<AudioBuffer> {
    // Return cached buffer if available
    if (this.bufferCache.has(path)) {
      return this.bufferCache.get(path)!;
    }

    // Return existing loading promise if in progress
    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path)!;
    }

    // Start new loading process
    const loadPromise = this.loadAudioFile(path);
    this.loadingPromises.set(path, loadPromise);

    try {
      const buffer = await loadPromise;
      // Cache the buffer for reuse
      this.bufferCache.set(path, buffer);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to load audio: ${path} - ${error}`);
      throw error;
    } finally {
      // Clean up loading promise
      this.loadingPromises.delete(path);
    }
  }

  /**
   * Internal method to load and decode audio file
   */
  private async loadAudioFile(path: string): Promise<AudioBuffer> {
    const audioContext = AudioContext.getInstance();
    
    if (!audioContext.initialized) {
      throw new Error("AudioContext not initialized");
    }

    const nativeContext = audioContext.nativeContext;
    if (!nativeContext) {
      throw new Error("No native AudioContext available");
    }

    try {
      // Fetch audio file
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get array buffer
      const arrayBuffer = await response.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await nativeContext.decodeAudioData(arrayBuffer);
      
      this.logger.debug(`Loaded audio buffer: ${path} (${audioBuffer.duration.toFixed(2)}s)`);
      return audioBuffer;
      
    } catch (error) {
      this.logger.error(`Audio loading failed: ${path} - ${error}`);
      throw error;
    }
  }

  /**
   * Check if audio buffer is cached
   */
  isBufferCached(path: string): boolean {
    return this.bufferCache.has(path);
  }

  /**
   * Get cached buffer without loading
   */
  getCachedBuffer(path: string): AudioBuffer | null {
    return this.bufferCache.get(path) || null;
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; paths: string[] } {
    return {
      size: this.bufferCache.size,
      paths: Array.from(this.bufferCache.keys())
    };
  }

  /**
   * Clear specific buffer from cache
   */
  clearBuffer(path: string): void {
    this.bufferCache.delete(path);
  }

  /**
   * Clear all cached buffers
   */
  clearAll(): void {
    this.bufferCache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Dispose of the loader and clean up resources
   */
  dispose(): void {
    this.clearAll();
    AudioLoader.instance = null;
  }
}