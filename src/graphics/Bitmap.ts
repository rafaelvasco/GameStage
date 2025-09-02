// Bitmap.ts - Bitmap pixel data management class
// Contains only pixel data state and methods to interact with pixel data and Texture

import { CanvasManager } from '../utils/CanvasManager';
import { Color32, Color32Utils } from './Color32';

/**
 * Blending modes for pixel operations
 */
export enum BlendMode {
  NORMAL = 'normal',
  MULTIPLY = 'multiply',
  SCREEN = 'screen',
  OVERLAY = 'overlay',
  DARKEN = 'darken',
  LIGHTEN = 'lighten',
  DIFFERENCE = 'difference',
  EXCLUSION = 'exclusion'
}

/**
 * Bitmap class for pixel data management
 * Contains only pixel data state and basic pixel access methods
 * All drawing operations are handled by the Blitter class
 */
export class Bitmap {
  private _imageData: ImageData;
  private _data8: Uint8ClampedArray;
  private _data32: Uint32Array;
  private _buffer: ArrayBuffer;
  private _width: number;
  private _height: number;

  // Single shared canvas for DOM operations when necessary
  private static _sharedCanvas: HTMLCanvasElement | null = null;
  private static _sharedCtx: CanvasRenderingContext2D | null = null;

  constructor(width: number, height: number);
  constructor(imageData: ImageData);
  constructor(widthOrImageData: number | ImageData, height?: number) {
    if (typeof widthOrImageData === 'number') {
      // Create new bitmap from dimensions
      this._width = widthOrImageData;
      this._height = height!;
      this._buffer = new ArrayBuffer(this._width * this._height * 4);
      this._data8 = new Uint8ClampedArray(this._buffer);
      this._data32 = new Uint32Array(this._buffer);
      this._imageData = new ImageData(this._data8, this._width, this._height);
    } else {
      // Create from existing ImageData
      const imageData = widthOrImageData;
      this._width = imageData.width;
      this._height = imageData.height;
      
      // Create 32-bit view of the same buffer for fast operations
      this._buffer = imageData.data.buffer.slice(imageData.data.byteOffset, imageData.data.byteOffset + imageData.data.byteLength);
      this._data32 = new Uint32Array(this._buffer);
      this._data8 = new Uint8ClampedArray(this._buffer);
      
      // Copy original data to our buffer
      this._data8.set(imageData.data);
      this._imageData = new ImageData(this._data8, this._width, this._height);
    }
  }

  /**
   * Get or create the shared canvas for DOM operations
   */
  private static getSharedCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    if (!Bitmap._sharedCanvas) {
      const canvasManager = CanvasManager.getInstance();
      const result = canvasManager.createSharedCanvas(CanvasManager.BITMAP_CONFIG);
      Bitmap._sharedCanvas = result.canvas;
      Bitmap._sharedCtx = result.ctx;
    }
    return { canvas: Bitmap._sharedCanvas, ctx: Bitmap._sharedCtx! };
  }

  // ===== STATIC FACTORY METHODS =====

  /**
   * Create a new Bitmap from dimensions
   */
  static create(width: number, height: number): Bitmap {
    return new Bitmap(width, height);
  }

  /**
   * Create a Bitmap from existing ImageData
   */
  static fromImageData(imageData: ImageData): Bitmap {
    return new Bitmap(imageData);
  }

  /**
   * Create a Bitmap from HTMLImageElement
   */
  static fromImage(image: HTMLImageElement): Bitmap {
    const { canvas, ctx } = Bitmap.getSharedCanvas();
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    return new Bitmap(imageData);
  }

  /**
   * Create a Bitmap from ImageBitmap
   */
  static fromImageBitmap(imageBitmap: ImageBitmap): Bitmap {
    const { canvas, ctx } = Bitmap.getSharedCanvas();
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
    return new Bitmap(imageData);
  }

  // ===== PROPERTIES =====

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get imageData(): ImageData {
    return this._imageData;
  }

  get data8(): Uint8ClampedArray {
    return this._data8;
  }

  get data32(): Uint32Array {
    return this._data32;
  }

  get buffer(): ArrayBuffer {
    return this._buffer;
  }

  // ===== COLOR UTILITIES =====

  /**
   * Create a 32-bit color from RGBA components
   */
  static rgba(r: number, g: number, b: number, a: number = 255): Color32 {
    return Color32Utils.rgba(r, g, b, a);
  }

  /**
   * Create a 32-bit color from RGB components (alpha = 255)
   */
  static rgb(r: number, g: number, b: number): Color32 {
    return Color32Utils.rgb(r, g, b);
  }

  /**
   * Extract RGBA components from 32-bit color
   */
  static toRGBA(color: Color32): { r: number; g: number; b: number; a: number } {
    return Color32Utils.toRGBA(color);
  }

  // ===== PIXEL OPERATIONS =====

  /**
   * Get a pixel color at the specified coordinates
   */
  getPixel(x: number, y: number): Color32 {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return 0;
    }
    return this._data32[y * this._width + x];
  }

  /**
   * Set a pixel color at the specified coordinates
   */
  setPixel(x: number, y: number, color: Color32): void {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return;
    }
    this._data32[y * this._width + x] = color;
  }

  /**
   * Get pixel RGBA components at the specified coordinates
   */
  getPixelRGBA(x: number, y: number): { r: number; g: number; b: number; a: number } {
    const color32 = this.getPixel(x, y);
    return Bitmap.toRGBA(color32);
  }

  /**
   * Set pixel RGBA components at the specified coordinates
   */
  setPixelRGBA(x: number, y: number, r: number, g: number, b: number, a: number = 255): void {
    const color32 = Bitmap.rgba(r, g, b, a);
    this.setPixel(x, y, color32);
  }

  // ===== COPY OPERATIONS =====

  /**
   * Copy data from another bitmap to this bitmap
   */
  copyFrom(source: Bitmap, sourceX = 0, sourceY = 0, width?: number, height?: number, destX = 0, destY = 0): void {
    const sourceData32 = source.data32;
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    
    const copyWidth = width || sourceWidth;
    const copyHeight = height || sourceHeight;
    
    const endX = Math.min(destX + copyWidth, this._width);
    const endY = Math.min(destY + copyHeight, this._height);
    const startX = Math.max(destX, 0);
    const startY = Math.max(destY, 0);
    
    for (let y = startY; y < endY; y++) {
      const sourceRowStart = (sourceY + (y - destY)) * sourceWidth + sourceX;
      const destRowStart = y * this._width + startX;
      const rowWidth = endX - startX;
      
      for (let i = 0; i < rowWidth; i++) {
        this._data32[destRowStart + i] = sourceData32[sourceRowStart + i];
      }
    }
  }

  /**
   * Fast copy from another bitmap (full bitmap copy)
   */
  copyFromFast(source: Bitmap): void {
    if (source.width !== this._width || source.height !== this._height) {
      throw new Error('Bitmap dimensions must match for fast copy');
    }
    this._data32.set(source.data32);
  }

  // ===== TEXTURE INTERACTION =====

  /**
   * Update the internal ImageData from the current pixel data
   * Call this before creating textures or using DOM operations
   */
  updateImageData(): void {
    // The ImageData shares the same buffer, so it's automatically updated
    // This method exists for API consistency and future optimizations
  }

  /**
   * Create a copy of this bitmap
   */
  clone(): Bitmap {
    const newBitmap = new Bitmap(this._width, this._height);
    newBitmap.copyFromFast(this);
    return newBitmap;
  }

  /**
   * Get bitmap info for debugging
   */
  getInfo(): { width: number; height: number; pixels: number; bytes: number } {
    return {
      width: this._width,
      height: this._height,
      pixels: this._width * this._height,
      bytes: this._buffer.byteLength
    };
  }
}