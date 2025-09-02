// Font.ts - Unified Font class for both Blitter and Canvas usage

import { Asset } from "../Asset";
import { Texture2D } from "../image/Texture2D";
import { Logger } from "../../utils/Logger";
import { TextureRegion } from "../../graphics/TextureRegion";
import { Bitmap } from "../../graphics/Bitmap";
import { CharsetPreset } from "./FontTypes";
import "../../utils/TypeExtensions";

/**
 * Single glyph in the font atlas
 */
export interface Glyph {
  char: string;
  charCode: number;
  region: TextureRegion;
  xAdvance: number;
  bearingX: number;
  bearingY: number;
  width: number;
  height: number;
}

/**
 * Kerning pair for character spacing adjustment
 */
export interface KerningPair {
  first: number;
  second: number;
  adjustment: number;
}


/**
 * Unified Font class that supports both Canvas (GPU texture atlas) and Blitter (software bitmap) rendering
 * The Font class contains an internal Bitmap with the font sheet and glyph data.
 * A nullable Texture is only instantiated when the Font is used for Canvas rendering.
 */
export class Font extends Asset {
  protected _fontSize: number;
  protected _charset: string;
  protected _originalCharsetDefinition: string | CharsetPreset | undefined;
  protected _lineHeight: number;

  // Core bitmap data - always present for both rendering modes
  protected _bitmap: Bitmap | null = null;
  protected _glyphs: Map<number, Glyph> = new Map();
  protected _kerning: Map<string, number> = new Map();
  
  // Optional texture for Canvas rendering - only created when needed
  protected _texture: Texture2D | null = null;
  
  protected _isValid: boolean = false;
  protected _ascent: number = 0;
  protected _descent: number = 0;

  protected logger: Logger;

  public static readonly DEFAULT_CHARSET = "latin-basic";

  public static readonly CHARSET_PRESETS = {
    "latin-basic":
      " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~",
    "latin-extended":
      " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~" +
      "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ",
  } as const;

  /**
   * Resolve a charset definition to a string of characters
   */
  public static resolveCharset(charset?: string | CharsetPreset): string {
    if (!charset) {
      return Font.CHARSET_PRESETS["latin-basic"];
    }

    if (typeof charset === "string") {
      return charset;
    }

    if (typeof charset === "object" && charset.preset) {
      const presetCharset = Font.CHARSET_PRESETS[charset.preset];
      if (!presetCharset) {
        throw new Error(`Unknown charset preset: ${charset.preset}`);
      }
      return presetCharset;
    }

    throw new Error("Invalid charset definition");
  }

  /**
   * Constructor for Font
   */
  constructor(
    id: string,
    fontSize: number,
    charset: string | CharsetPreset | undefined,
    filePath: string | null = null
  ) {
    super(id, filePath);
    this._fontSize = fontSize;
    this._charset = Font.resolveCharset(charset);
    this._originalCharsetDefinition = charset;
    this._lineHeight = Math.ceil(fontSize * 1.2); // Default line height is 120% of font size

    this.logger = Logger.getInstance();
  }

  /**
   * Set the internal bitmap data (called by FontAtlasBlitter) and eagerly create texture
   */
  setBitmapData(bitmap: Bitmap, glyphs: Map<number, Glyph>, kerning: Map<string, number>, ascent: number, descent: number): void {
    // Clear existing data
    this._bitmap = null;
    
    this._bitmap = bitmap;
    this._glyphs = glyphs;
    this._kerning = kerning;
    this._ascent = ascent;
    this._descent = descent;
    this._isValid = true;

    // Invalidate texture so it gets recreated with new bitmap data
    this.invalidateTexture();
    
    // Eagerly create texture for immediate availability during rendering
    this.createTextureEagerly();
  }

  /**
   * Eagerly create the texture from bitmap data (non-blocking)
   */
  private createTextureEagerly(): void {
    // Create texture asynchronously without blocking
    this.getTexture().catch(error => {
      this.logger.error(`Failed to eagerly create font texture for '${this._id}': ${error}`);
    });
  }

  /**
   * Load the font asset - should be called by FontFactory after FontAtlasBlitter processes it
   */
  async load(): Promise<void> {
    if (this._isValid && this._bitmap) {
      return;
    }

    throw new Error("Font must be processed by FontAtlasBlitter before loading. Use FontFactory.createFont() instead.");
  }

  /**
   * Get or create texture for Canvas rendering
   */
  async getTexture(): Promise<Texture2D> {
    if (!this._bitmap || !this._isValid) {
      throw new Error("Font bitmap not loaded. Call load() first.");
    }

    if (!this._texture) {
      // Create texture from bitmap
      const imageData = new ImageData(
        new Uint8ClampedArray(this._bitmap.data8.buffer),
        this._bitmap.width,
        this._bitmap.height
      );
      
      this._texture = await Texture2D.fromImageData(
        `font-texture-${this._id}`,
        imageData
      );

      // Use nearest neighbor filtering for pixel-perfect rendering
      this._texture.setFilter("nearest", "nearest");
      this._texture.setAddressMode("clamp-to-edge", "clamp-to-edge");
    }

    return this._texture;
  }

  /**
   * Get bitmap for Blitter rendering
   */
  getBitmap(): Bitmap {
    if (!this._bitmap || !this._isValid) {
      throw new Error("Font bitmap not loaded. Call load() first.");
    }
    return this._bitmap;
  }

  /**
   * Dispose of the font asset
   */
  dispose(): void {
    if (this._texture) {
      this._texture.dispose();
      this._texture = null;
    }

    this._bitmap = null;

    this._glyphs.clear();
    this._kerning.clear();
    this._isValid = false;
    
    // Clear pre-allocated arrays
    this.tempGraphemes.length = 0;

    this.logger.debug(`Font '${this._id}' disposed`);
  }

  /**
   * Check if font is loaded
   */
  get isLoaded(): boolean {
    return this._isValid && this._bitmap !== null;
  }

  get fontSize(): number {
    return this._fontSize;
  }

  get charset(): string {
    return this._charset;
  }

  get lineHeight(): number {
    return this._lineHeight;
  }

  set lineHeight(value: number) {
    this._lineHeight = value;
  }


  get ascent(): number {
    return this._ascent;
  }

  get descent(): number {
    return this._descent;
  }

  /**
   * Get the texture if it's already created (synchronous access)
   * Returns null if texture hasn't been created yet
   */
  get texture(): Texture2D | null {
    return this._texture;
  }

  /**
   * Invalidate the current texture (bitmap stays valid)
   */
  private invalidateTexture(): void {
    if (this._texture) {
      this._texture.dispose();
      this._texture = null;
    }
  }

  /**
   * Get glyph information for a character
   */
  getGlyph(char: string): Glyph | null {
    const charCode = char.charCodeAt(0);
    return this._glyphs.get(charCode) || null;
  }

  /**
   * Get kerning adjustment between two characters
   */
  getKerning(firstChar: string, secondChar: string): number {
    const firstCode = firstChar.charCodeAt(0);
    const secondCode = secondChar.charCodeAt(0);
    const key = `${firstCode},${secondCode}`;
    return this._kerning.get(key) || 0;
  }

  // Pre-allocated array for grapheme splitting to reduce allocations
  private readonly tempGraphemes: string[] = [];

  /**
   * Split text into grapheme clusters
   */
  protected splitGraphemes(text: string): string[] {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter("en", {
        granularity: "grapheme",
      });
      return Array.from(
        segmenter.segment(text),
        (segment) => segment.segment
      );
    }
    return Array.from(text);
  }

  /**
   * Split text into grapheme clusters, reusing internal array to avoid allocations
   */
  protected splitGraphemesInto(text: string): string[] {
    this.tempGraphemes.length = 0;
    
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter("en", {
        granularity: "grapheme",
      });
      for (const segment of segmenter.segment(text)) {
        this.tempGraphemes.push(segment.segment);
      }
    } else {
      for (let i = 0; i < text.length; i++) {
        this.tempGraphemes.push(text[i]);
      }
    }
    
    return this.tempGraphemes;
  }

  /**
   * Measure text width with kerning
   * For multi-line text, returns the width of the widest line
   */
  measureText(text: string): number {
    if (!this._isValid) {
      return 0;
    }

    // Handle multi-line text by measuring each line separately
    const lines = text.split("\n");
    let maxWidth = 0;

    for (const line of lines) {
      const lineWidth = this.measureSingleLineText(line);
      maxWidth = Math.max(maxWidth, lineWidth);
    }

    return maxWidth;
  }

  /**
   * Measure a single line of text width with kerning
   * @param text - Single line text (should not contain newlines)
   */
  private measureSingleLineText(text: string): number {
    if (!this._isValid) {
      return 0;
    }

    const graphemes = this.splitGraphemesInto(text);
    let width = 0;

    for (let i = 0; i < graphemes.length; i++) {
      const char = graphemes[i];
      const glyph = this.getGlyph(char);

      if (glyph) {
        width += glyph.xAdvance;

        if (i < graphemes.length - 1) {
          const nextChar = graphemes[i + 1];
          width += this.getKerning(char, nextChar);
        }
      }
    }

    return width;
  }

  /**
   * Measure text size with kerning
   */
  measureTextSize(text: string): { width: number; height: number } {
    const lines = text.split("\n");
    let maxWidth = 0;

    for (const line of lines) {
      const lineWidth = this.measureSingleLineText(line);
      maxWidth = Math.max(maxWidth, lineWidth);
    }

    const height = lines.length * this._lineHeight;

    return { width: maxWidth, height };
  }
}