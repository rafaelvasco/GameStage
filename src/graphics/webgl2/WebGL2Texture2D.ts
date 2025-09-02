// WebGL2Texture2D.ts - WebGL2-specific texture implementation

import { ITexture2D } from "../ITexture2D";
import { WebGL2Graphics } from "./WebGL2Graphics";

export class WebGL2Texture2D implements ITexture2D {
  private _texture: WebGLTexture | null = null;
  private _sampler: WebGLSampler | null = null;
  private _width: number = 0;
  private _height: number = 0;
  private _loaded: boolean = false;
  private graphics: WebGL2Graphics;

  constructor() {
    this.graphics = WebGL2Graphics.getInstance();
  }

  get nativeTexture(): WebGLTexture {
    if (!this._texture) {
      throw new Error("WebGL2 texture is not loaded");
    }
    return this._texture;
  }

  get nativeSampler(): WebGLSampler {
    if (!this._sampler) {
      throw new Error("WebGL2 sampler is not created");
    }
    return this._sampler;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get isLoaded(): boolean {
    return this._loaded;
  }

  loadFromImageData(
    imageData: ImageData | HTMLImageElement | ImageBitmap
  ): void {
    if (this._loaded) {
      return;
    }

    // Store dimensions
    if (imageData instanceof ImageData) {
      this._width = imageData.width;
      this._height = imageData.height;
    } else if (imageData instanceof HTMLImageElement) {
      this._width = imageData.naturalWidth;
      this._height = imageData.naturalHeight;
    } else {
      this._width = imageData.width;
      this._height = imageData.height;
    }

    // Create the WebGL2 texture
    this._texture = this.graphics.createTextureFromImageData(imageData);

    // Create a default sampler
    this._sampler = this.graphics.createSampler();

    this._loaded = true;
  }

  createView(_descriptor?: any): null {
    // WebGL2 doesn't have texture views like WebGPU
    return null;
  }

  createCustomSampler(
    magFilter: string = "nearest",
    minFilter: string = "nearest",
    addressModeU: string = "clamp-to-edge",
    addressModeV: string = "clamp-to-edge"
  ): WebGLSampler {
    // WebGL2 doesn't support "mirror-repeat", fall back to "repeat"
    const webglAddressModeU =
      addressModeU === "mirror-repeat" ? "repeat" : addressModeU;
    const webglAddressModeV =
      addressModeV === "mirror-repeat" ? "repeat" : addressModeV;

    return this.graphics.createSampler(
      magFilter,
      minFilter,
      webglAddressModeU,
      webglAddressModeV
    );
  }

  dispose(): void {
    const gl = this.graphics.getGL();
    
    if (this._texture && gl) {
      gl.deleteTexture(this._texture);
      this._texture = null;
    } else if (this._texture) {
      // Context may be disposed already, but still clear reference
      this._texture = null;
    }

    if (this._sampler && gl) {
      gl.deleteSampler(this._sampler);
      this._sampler = null;
    } else if (this._sampler) {
      // Context may be disposed already, but still clear reference
      this._sampler = null;
    }

    this._loaded = false;
    this._width = 0;
    this._height = 0;
  }
}
