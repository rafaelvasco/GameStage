// IGraphicsContext.ts - Interface for graphics contexts/backends

import { Color } from "./Color";

export interface RenderingStats {
  // Draw call and batching stats (from previous completed frame)
  drawCallCount: number; // Total draw calls made in the last frame
  batchCount: number; // Total batches processed in the last frame
  pendingQuads: number; // Currently queued quads waiting to be rendered
  maxQuadsPerBatch: number; // Maximum quads that can be batched together

  // Memory and performance stats
  vertexBufferUsage: number; // Percentage of vertex buffer used
  quadPoolUtilization: number; // Percentage of object pool used
}

export interface IGraphicsContext {
  /**
   * Initialize the renderer
   */
  initialize(canvasId: string): Promise<boolean>;

  /**
   * Check if the renderer is initialized
   */
  get isInitialized(): boolean;

  /**
   * Get the canvas element
   */
  get canvas(): HTMLCanvasElement;

  /**
   * Create a texture from image data
   */
  createTextureFromImageData(
    imageData: ImageData | HTMLImageElement | ImageBitmap,
    usage?: number
  ): any; // Return type depends on backend

  /**
   * Create a sampler
   */
  createSampler(
    magFilter?: string,
    minFilter?: string,
    addressModeU?: string,
    addressModeV?: string
  ): any; // Return type depends on backend

  /**
   * Begin a new frame for rendering
   */
  beginFrame(clearColor?: Color, projectionMatrix?: Float32Array): void;

  /**
   * End the current frame and submit commands
   */
  endFrame(): void;

  /**
   * Draw a textured quad with vertex positions, UV coordinates, and vertex colors
   */
  drawQuad(
    texture: any,
    sampler: any,
    vertices: Float32Array, // [ax, ay, bx, by, cx, cy, dx, dy] - 8 floats
    uvRegion: Float32Array, // [u1, v1, u2, v2] - 4 floats
    vertexColors: Uint32Array // [c1, c2, c3, c4] - 4 RGBA integers
  ): void;

  /**
   * Force flush any pending batched operations
   */
  flush(): void;

  /**
   * Create a command encoder
   */
  createCommandEncoder(label?: string): any; // Return type depends on backend

  /**
   * Submit command buffers
   */
  submitCommands(commandBuffers: any[]): void; // Type depends on backend

  /**
   * Get comprehensive rendering statistics for debugging and performance monitoring
   */
  getRenderingStats(): RenderingStats;

  /**
   * Clear all caches (should only be used during shutdown or major state changes)
   */
  clearCaches(): void;

  /**
   * Perform lightweight cache maintenance (removes only stale entries)
   */
  maintainCaches(): void;
}
