// ITexture2D.ts - Interface for backend-specific texture implementations

export interface ITexture2D {
  /**
   * Get the native texture object (GPUTexture for WebGPU, WebGLTexture for WebGL2)
   */
  get nativeTexture(): any;

  /**
   * Get the native sampler object (GPUSampler for WebGPU, WebGLSampler for WebGL2)
   */
  get nativeSampler(): any;

  /**
   * Get texture width
   */
  get width(): number;

  /**
   * Get texture height
   */
  get height(): number;

  /**
   * Check if texture is loaded
   */
  get isLoaded(): boolean;

  /**
   * Load texture from image data
   */
  loadFromImageData(
    imageData: ImageData | HTMLImageElement | ImageBitmap
  ): void;

  /**
   * Create a texture view (WebGPU specific, returns null for WebGL2)
   * @internal - This is for internal use only
   */
  createView(descriptor?: any): any;

  /**
   * Create a custom sampler
   * @internal - This is for internal use only
   */
  createCustomSampler(
    magFilter?: string,
    minFilter?: string,
    addressModeU?: string,
    addressModeV?: string
  ): any;

  /**
   * Dispose of the texture resources
   */
  dispose(): void;
}
