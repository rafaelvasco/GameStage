// IRenderer.ts - Base interface for Canvas renderers

import { Graphics } from "../Graphics";
import { Texture2D } from "../../content/image/Texture2D";
import { Logger } from "../../utils";

/**
 * Base interface for all Canvas renderer components.
 * Provides common initialization and shared resource access.
 */
export interface IRenderer {
  /**
   * Initialize the renderer with shared Canvas resources
   * @param graphics - Graphics context for rendering operations
   * @param whiteTexture - 1x1 white texture for primitive drawing
   * @param logger - Logger instance for debugging
   * @param getCurrentTransform - Function to get current transform matrix
   * @param getCachedArrays - Function to get reusable cached arrays
   */
  initialize(
    graphics: Graphics,
    whiteTexture: Texture2D,
    logger: Logger,
    getCurrentTransform: () => Float32Array,
    getCachedArrays: () => {
      corners: Float32Array;
      transformedCorners: Float32Array;
      uvRegion: Float32Array;
      calculatedUVRegion: Float32Array;
      vertexColors: Uint32Array;
      cachedVertexColors: Uint32Array;
    }
  ): void;
}

/**
 * Base renderer class providing common functionality
 */
export abstract class BaseRenderer implements IRenderer {
  protected graphics!: Graphics;
  protected whiteTexture!: Texture2D;
  protected logger!: Logger;
  protected getCurrentTransform!: () => Float32Array;
  protected getCachedArrays!: () => {
    corners: Float32Array;
    transformedCorners: Float32Array;
    uvRegion: Float32Array;
    calculatedUVRegion: Float32Array;
    vertexColors: Uint32Array;
    cachedVertexColors: Uint32Array;
  };

  initialize(
    graphics: Graphics,
    whiteTexture: Texture2D,
    logger: Logger,
    getCurrentTransform: () => Float32Array,
    getCachedArrays: () => {
      corners: Float32Array;
      transformedCorners: Float32Array;
      uvRegion: Float32Array;
      calculatedUVRegion: Float32Array;
      vertexColors: Uint32Array;
      cachedVertexColors: Uint32Array;
    }
  ): void {
    this.graphics = graphics;
    this.whiteTexture = whiteTexture;
    this.logger = logger;
    this.getCurrentTransform = getCurrentTransform;
    this.getCachedArrays = getCachedArrays;
  }

  /**
   * Check if renderer is properly initialized
   */
  protected ensureInitialized(): void {
    if (!this.graphics || !this.whiteTexture) {
      throw new Error(`${this.constructor.name} not properly initialized`);
    }
  }
}