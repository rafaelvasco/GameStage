// Texture2D.ts - 2D Texture asset class

import { Asset } from "../Asset";
import { Graphics } from "../../graphics";
import { ITexture2D } from "../../graphics";
import { ImageLoader } from "../loaders";
import { logger } from "../../utils";

export type TextureFilter = "nearest" | "linear";
export type TextureAddressMode = "clamp-to-edge" | "repeat" | "mirror-repeat";

export class Texture2D extends Asset {
  private _backendTexture: ITexture2D | null = null;
  private _magFilter: TextureFilter = "nearest";
  private _minFilter: TextureFilter = "nearest";
  private _addressModeU: TextureAddressMode = "clamp-to-edge";
  private _addressModeV: TextureAddressMode = "clamp-to-edge";
  private _customSampler: any = null;

  constructor(id: string, filePath: string | null = null) {
    super(id, filePath);
  }

  /**
   * Creates a Texture2D from a file path
   */
  static fromFile(id: string, filePath: string): Texture2D {
    return new Texture2D(id, filePath);
  }

  /**
   * Creates a Texture2D from image data
   */
  static async fromImageData(
    id: string,
    imageData: ImageData | HTMLImageElement | ImageBitmap
  ): Promise<Texture2D> {
    const texture = new Texture2D(id, null);
    await texture.createFromImageData(imageData);
    return texture;
  }

  private async createFromImageData(
    imageData: ImageData | HTMLImageElement | ImageBitmap
  ): Promise<void> {
    const graphics = Graphics.getInstance();
    this._backendTexture = graphics.createTexture2D();
    this._backendTexture.loadFromImageData(imageData);
    this.updateSampler();
  }

  private updateSampler(): void {
    if (!this._backendTexture) return;

    this._customSampler = this._backendTexture.createCustomSampler(
      this._magFilter,
      this._minFilter,
      this._addressModeU,
      this._addressModeV
    );
  }

  get texture(): any {
    if (!this._backendTexture) {
      throw new Error(`Texture2D '${this.id}' is not loaded`);
    }
    return this._backendTexture.nativeTexture;
  }

  get sampler(): any {
    if (!this._backendTexture) {
      throw new Error(`Texture2D '${this.id}' sampler is not created`);
    }
    // Return custom sampler if available, otherwise default sampler
    return this._customSampler || this._backendTexture.nativeSampler;
  }

  get width(): number {
    return this._backendTexture ? this._backendTexture.width : 0;
  }

  get height(): number {
    return this._backendTexture ? this._backendTexture.height : 0;
  }

  get isLoaded(): boolean {
    return this._backendTexture ? this._backendTexture.isLoaded : false;
  }

  /**
   * Check if the backend texture has been created
   */
  get hasBackendTexture(): boolean {
    return this._backendTexture !== null;
  }

  /**
   * Get the magnification filter mode
   */
  get magFilter(): TextureFilter {
    return this._magFilter;
  }

  /**
   * Set the magnification filter mode
   */
  set magFilter(value: TextureFilter) {
    if (this._magFilter !== value) {
      this._magFilter = value;
      this.updateSampler();
    }
  }

  /**
   * Get the minification filter mode
   */
  get minFilter(): TextureFilter {
    return this._minFilter;
  }

  /**
   * Set the minification filter mode
   */
  set minFilter(value: TextureFilter) {
    if (this._minFilter !== value) {
      this._minFilter = value;
      this.updateSampler();
    }
  }

  /**
   * Get the U (horizontal) address mode
   */
  get addressModeU(): TextureAddressMode {
    return this._addressModeU;
  }

  /**
   * Set the U (horizontal) address mode
   */
  set addressModeU(value: TextureAddressMode) {
    if (this._addressModeU !== value) {
      this._addressModeU = value;
      this.updateSampler();
    }
  }

  /**
   * Get the V (vertical) address mode
   */
  get addressModeV(): TextureAddressMode {
    return this._addressModeV;
  }

  /**
   * Set the V (vertical) address mode
   */
  set addressModeV(value: TextureAddressMode) {
    if (this._addressModeV !== value) {
      this._addressModeV = value;
      this.updateSampler();
    }
  }

  /**
   * Set both address modes at once
   */
  setAddressMode(u: TextureAddressMode, v?: TextureAddressMode): void {
    const newV = v !== undefined ? v : u;
    if (this._addressModeU !== u || this._addressModeV !== newV) {
      this._addressModeU = u;
      this._addressModeV = newV;
      this.updateSampler();
    }
  }

  /**
   * Set both filter modes at once
   */
  setFilter(mag: TextureFilter, min?: TextureFilter): void {
    const newMin = min !== undefined ? min : mag;
    if (this._magFilter !== mag || this._minFilter !== newMin) {
      this._magFilter = mag;
      this._minFilter = newMin;
      this.updateSampler();
    }
  }

  async load(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    // Skip loading for programmatic textures (already loaded)
    if (!this._filePath) {
      return;
    }

    try {
      const graphics = Graphics.getInstance();

      // Create the appropriate backend texture implementation
      this._backendTexture = graphics.createTexture2D();

      // Load the image
      const image = await ImageLoader.getInstance().loadImage(this._filePath);

      // Load the image data into the backend texture
      this._backendTexture.loadFromImageData(image);

      // Create custom sampler with current settings
      this.updateSampler();

      logger.debug(
        `Texture2D '${this.id}' loaded successfully from '${this._filePath}' (${this.width}x${this.height}) using ${graphics.backendType}`
      );
    } catch (error) {
      logger.error(
        `Failed to load Texture2D '${this.id}' from path '${this._filePath}': ${error}`
      );
      throw new Error(
        `Failed to load Texture2D '${this.id}' from '${this._filePath}': ${error}`
      );
    }
  }

  dispose(): void {
    if (this._backendTexture) {
      this._backendTexture.dispose();
      this._backendTexture = null;
    }

    this._customSampler = null;

    logger.debug(`Texture2D '${this.id}' disposed`);
  }

  /**
   * Gets the backend-specific texture implementation
   * @internal - This is for internal use only
   */
  get backendTexture(): ITexture2D {
    if (!this._backendTexture) {
      throw new Error(`Texture2D '${this.id}' is not loaded`);
    }
    return this._backendTexture;
  }

  /**
   * Creates a texture view for rendering (WebGPU only, returns null for WebGL2)
   * @internal - This is for internal use only
   */
  createTextureView(descriptor?: any): any {
    if (!this._backendTexture) {
      throw new Error(`Texture2D '${this.id}' is not loaded`);
    }
    return this._backendTexture.createView(descriptor);
  }
}
