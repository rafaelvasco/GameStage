// WebGPUTexture2D.ts - WebGPU-specific texture implementation

import { ITexture2D } from "../ITexture2D";
import { WebGPUGraphics } from "./WebGPUGraphics";

export class WebGPUTexture2D implements ITexture2D {
  private _texture: GPUTexture | null = null;
  private _sampler: GPUSampler | null = null;
  private _width: number = 0;
  private _height: number = 0;
  private _loaded: boolean = false;
  private graphics: WebGPUGraphics;

  constructor() {
    this.graphics = WebGPUGraphics.getInstance();
  }

  get nativeTexture(): GPUTexture {
    if (!this._texture) {
      throw new Error("WebGPU texture is not loaded");
    }
    return this._texture;
  }

  get nativeSampler(): GPUSampler {
    if (!this._sampler) {
      throw new Error("WebGPU sampler is not created");
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

    // Create the GPU texture
    this._texture = this.graphics.createTextureFromImageData(imageData);

    // Create a default sampler
    this._sampler = this.graphics.createSampler();

    this._loaded = true;
  }

  createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView {
    return this.nativeTexture.createView(descriptor);
  }

  createCustomSampler(
    magFilter: string = "nearest",
    minFilter: string = "nearest",
    addressModeU: string = "clamp-to-edge",
    addressModeV: string = "clamp-to-edge"
  ): GPUSampler {
    // Convert string parameters to WebGPU types
    const webgpuMagFilter = magFilter as GPUFilterMode;
    const webgpuMinFilter = minFilter as GPUFilterMode;
    const webgpuAddressModeU = addressModeU as GPUAddressMode;
    const webgpuAddressModeV = addressModeV as GPUAddressMode;

    return this.graphics.createSampler(
      webgpuMagFilter,
      webgpuMinFilter,
      webgpuAddressModeU,
      webgpuAddressModeV
    );
  }

  dispose(): void {
    if (this._texture) {
      // Note: WebGPU textures don't have an explicit dispose method in the current API
      // The GPU will handle cleanup when the texture is no longer referenced
      this._texture = null;
    }

    if (this._sampler) {
      // Note: WebGPU samplers don't have an explicit dispose method in the current API
      this._sampler = null;
    }

    this._loaded = false;
    this._width = 0;
    this._height = 0;
  }
}
