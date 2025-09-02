// FontAtlasBlitter.ts - Font atlas building system with effects support

import { Bitmap } from "../../graphics/Bitmap";
import { Color32 } from "../../graphics/Color32";
import { TextureRegion } from "../../graphics/TextureRegion";
import { Logger } from "../../utils/Logger";
import { CanvasManager } from "../../utils/CanvasManager";
import { FileFontLoader } from "../loaders/FileFontLoader";
import { Glyph, Font } from "./Font";
import { 
  CharacterPattern, 
  FontEffect, 
  FontEffectConfig, 
  FontStyle, 
  FontRenderingOptions,
  GlyphMetrics 
} from "./FontTypes";

/**
 * Configuration for pattern-based font atlas generation
 */
export interface PatternFontConfig {
  type: 'pattern';
  characterPatterns: CharacterPattern;
  charWidth: number;
  charHeight: number;
  atlasCols?: number;
  atlasRows?: number;
  spacing?: number;
  baseColor?: Color32;
  effects?: FontEffectConfig[];
}

/**
 * Configuration for file-based font atlas generation
 */
export interface FileFontConfig {
  type: 'file';
  fontFamily: string;
  fontStyle?: FontStyle;
  source: "native" | "file";
  path: string;
  rendering?: FontRenderingOptions;
  baseColor?: Color32;
  effects?: FontEffectConfig[];
}


/**
 * Rectangle packing node for atlas packing
 */
class PackingNode {
  x: number;
  y: number;
  width: number;
  height: number;
  used: boolean = false;
  right?: PackingNode;
  down?: PackingNode;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  insert(width: number, height: number): PackingNode | null {
    if (this.right || this.down) {
      return (
        this.right?.insert(width, height) ||
        this.down?.insert(width, height) ||
        null
      );
    }

    if (this.used) {
      return null;
    }

    if (width > this.width || height > this.height) {
      return null;
    }

    if (width === this.width && height === this.height) {
      this.used = true;
      return this;
    }

    const dw = this.width - width;
    const dh = this.height - height;

    if (dw > dh) {
      this.right = new PackingNode(this.x + width, this.y, dw, this.height);
      this.down = new PackingNode(this.x, this.y + height, width, dh);
    } else {
      this.right = new PackingNode(this.x + width, this.y, dw, height);
      this.down = new PackingNode(this.x, this.y + height, this.width, dh);
    }

    this.used = true;
    return this;
  }
}

/**
 * FontAtlasBlitter class responsible for building font atlases from different sources
 * Supports both pattern-based and file-based fonts with effects
 */
export class FontAtlasBlitter {
  private logger: Logger;
  private fontLoader: FileFontLoader;

  private static readonly PADDING = 1;

  constructor() {
    this.logger = Logger.getInstance();
    this.fontLoader = FileFontLoader.getInstance();
  }

  /**
   * Build font atlas from configuration and populate the font
   */
  async buildFontAtlas(
    font: Font, 
    config: PatternFontConfig | FileFontConfig
  ): Promise<void> {
    try {
      if (config.type === 'pattern') {
        await this.buildPatternFontAtlas(font, config);
      } else {
        await this.buildFileFontAtlas(font, config);
      }
    } catch (error) {
      this.logger.error(`Failed to build font atlas for '${font.id}': ${error}`);
      throw error;
    }
  }

  /**
   * Build atlas from character patterns
   */
  private async buildPatternFontAtlas(font: Font, config: PatternFontConfig): Promise<void> {
    const {
      characterPatterns,
      charWidth,
      charHeight,
      atlasCols = 16,
      atlasRows = 6,
      baseColor = 0xFFFFFFFF,
      effects = []
    } = config;

    // Calculate effect padding
    const effectPadding = this.calculateEffectPadding(effects);
    const effectiveCharWidth = charWidth + (effectPadding * 2);
    const effectiveCharHeight = charHeight + (effectPadding * 2);
    
    const atlasWidth = atlasCols * effectiveCharWidth;
    const atlasHeight = atlasRows * effectiveCharHeight;

    // Create bitmap for the atlas
    const atlasBitmap = Bitmap.create(atlasWidth, atlasHeight);
    const data32 = atlasBitmap.data32;

    // Clear to transparent
    data32.fill(0);

    const glyphs = new Map<number, Glyph>();
    const kerning = new Map<string, number>();

    let charIndex = 0;
    for (let i = 0; i < font.charset.length; i++) {
      const char = font.charset[i];
      const charCode = char.charCodeAt(0);

      // Skip characters we don't have patterns for
      if (!characterPatterns[charCode]) {
        continue;
      }

      const col = charIndex % atlasCols;
      const row = Math.floor(charIndex / atlasCols);

      // Calculate position in atlas
      const x = col * effectiveCharWidth;
      const y = row * effectiveCharHeight;

      // Generate the character with effects
      const charBitmap = this.generatePatternCharacterBitmap(
        char, 
        characterPatterns[charCode], 
        charWidth, 
        charHeight, 
        effectiveCharWidth, 
        effectiveCharHeight, 
        baseColor, 
        effects, 
        effectPadding
      );
      
      // Draw the character bitmap to atlas
      this.drawBitmapToAtlas(
        data32,
        atlasWidth,
        x,
        y,
        charBitmap.data32,
        charBitmap.width,
        charBitmap.height
      );

      // Create glyph info
      const region: TextureRegion = {
        x,
        y,
        width: effectiveCharWidth,
        height: effectiveCharHeight,
      };

      const glyph: Glyph = {
        char,
        charCode,
        region,
        xAdvance: effectiveCharWidth,
        bearingX: 0,
        bearingY: effectiveCharHeight,
        width: effectiveCharWidth,
        height: effectiveCharHeight,
      };

      glyphs.set(charCode, glyph);
      charIndex++;

      // Character bitmap processing complete
    }

    const ascent = effectiveCharHeight;
    const descent = 0;

    // Set the bitmap data to the font
    font.setBitmapData(atlasBitmap, glyphs, kerning, ascent, descent);

    this.logger.success(
      `Pattern font atlas generated: ${charIndex} glyphs, ${atlasWidth}x${atlasHeight}px`
    );
  }

  /**
   * Build atlas from font files
   */
  private async buildFileFontAtlas(font: Font, config: FileFontConfig): Promise<void> {
    const {
      fontFamily,
      fontStyle = {},
      source,
      path,
      rendering = {},
      baseColor = 0xFFFFFFFF,
      effects = []
    } = config;

    // Load font face if it's a file-based font
    let fontFace: FontFace | null = null;
    if (source === "file") {
      fontFace = await this.fontLoader.loadFileFont(fontFamily, path);
    }

    // Resolve rendering options
    let resolvedOptions = { ...rendering };
    if (rendering.preset) {
      const presets = this.getFontRenderingPresets();
      const presetOptions = presets[rendering.preset];
      if (presetOptions) {
        resolvedOptions = {
          ...presetOptions,
          ...rendering,
          preset: undefined,
        };
      }
    }

    const {
      antiAliasing = true,
      textRenderingOptimization = "optimizeLegibility",
    } = resolvedOptions;

    // Build font string
    const weight = fontStyle.weight || "normal";
    const style = fontStyle.style || "normal";
    const variant = fontStyle.variant || "normal";
    const fontString = `${style} ${variant} ${weight} ${font.fontSize}px ${fontFamily}`;

    // Create temporary canvas for measurements and rendering
    const canvasManager = CanvasManager.getInstance();
    const tempCanvasResult = canvasManager.rentCanvas(100, 100, CanvasManager.FONT_CONFIG);

    try {
      // Configure canvas for font rendering
      this.setupCanvasForFontRendering(
        tempCanvasResult.ctx,
        fontString,
        antiAliasing,
        textRenderingOptimization
      );

      // Measure font-level metrics
      const fontMetrics = this.measureFontMetrics(
        tempCanvasResult.ctx,
        font.fontSize,
        font.charset
      );

      // Split charset and filter valid characters
      const characters = this.splitGraphemes(font.charset);
      const uniqueChars = Array.from(new Set(characters)).filter(
        (char) => char.length > 0
      );

      // Measure all glyphs
      const glyphMetrics: GlyphMetrics[] = [];
      for (const char of uniqueChars) {
        if (char === " ") {
          const spaceMetrics = tempCanvasResult.ctx.measureText(" ");
          const spaceAdvance = Math.max(
            Math.ceil(spaceMetrics.width),
            Math.ceil(font.fontSize * 0.2)
          );

          glyphMetrics.push({
            char: " ",
            charCode: 32,
            width: 0,
            height: 0,
            bearingX: 0,
            bearingY: 0,
            advance: spaceAdvance,
          });
        } else {
          const metrics = this.measureGlyph(char, tempCanvasResult.ctx, font.fontSize);
          glyphMetrics.push(metrics);
        }
      }

      // Separate visible glyphs for atlas packing
      const visibleGlyphs = glyphMetrics.filter(
        (g) => g.width > 0 && g.height > 0
      );

      if (visibleGlyphs.length === 0) {
        // Handle edge case: only space characters
        const emptyBitmap = Bitmap.create(1, 1);
        const glyphs = new Map<number, Glyph>();
        const kerning = new Map<string, number>();
        
        // Add space character
        const spaceGlyph = glyphMetrics.find((g) => g.char === " ");
        if (spaceGlyph) {
          const spaceGlyphData: Glyph = {
            char: " ",
            charCode: 32,
            region: { x: 0, y: 0, width: 0, height: 0 } as TextureRegion,
            xAdvance: spaceGlyph.advance,
            bearingX: 0,
            bearingY: 0,
            width: 0,
            height: 0,
          };
          glyphs.set(32, spaceGlyphData);
        }
        
        font.setBitmapData(emptyBitmap, glyphs, kerning, fontMetrics.ascent, fontMetrics.descent);
        return;
      }

      // Calculate effect padding
      const effectPadding = this.calculateEffectPadding(effects);
      
      // Add padding to glyph dimensions for effects
      const paddedGlyphs = visibleGlyphs.map((glyph) => ({
        ...glyph,
        width: glyph.width + (effectPadding * 2) + (FontAtlasBlitter.PADDING * 2),
        height: glyph.height + (effectPadding * 2) + (FontAtlasBlitter.PADDING * 2),
      }));

      // Pack glyphs into atlas
      const { packed, width: atlasWidth, height: atlasHeight } = this.packGlyphs(paddedGlyphs);

      // Create atlas bitmap
      const atlasBitmap = Bitmap.create(atlasWidth, atlasHeight);
      
      // Set up canvas for atlas rendering
      tempCanvasResult.canvas.width = atlasWidth;
      tempCanvasResult.canvas.height = atlasHeight;
      tempCanvasResult.ctx.clearRect(0, 0, atlasWidth, atlasHeight);

      // Reconfigure canvas after resize
      this.setupCanvasForFontRendering(
        tempCanvasResult.ctx,
        fontString,
        antiAliasing,
        textRenderingOptimization
      );

      // Render glyphs with effects into canvas
      const glyphs = new Map<number, Glyph>();
      const kerning = new Map<string, number>();

      for (const packedGlyph of packed) {
        const { glyph, x, y } = packedGlyph;

        // Render glyph with effects to canvas
        this.renderGlyphWithEffects(
          tempCanvasResult.ctx,
          glyph.char,
          x + FontAtlasBlitter.PADDING + effectPadding,
          y + FontAtlasBlitter.PADDING + effectPadding + glyph.bearingY,
          baseColor,
          effects
        );

        // Store glyph info
        const glyphData: Glyph = {
          char: glyph.char,
          charCode: glyph.charCode,
          region: {
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(glyph.width),
            height: Math.round(glyph.height),
          } as TextureRegion,
          xAdvance: Math.round(glyph.advance),
          bearingX: Math.round(glyph.bearingX),
          bearingY: Math.round(glyph.bearingY),
          width: Math.round(glyph.width),
          height: Math.round(glyph.height),
        };

        glyphs.set(glyph.charCode, glyphData);
      }

      // Add space character
      const spaceGlyph = glyphMetrics.find((g) => g.char === " ");
      if (spaceGlyph) {
        const spaceGlyphData: Glyph = {
          char: " ",
          charCode: 32,
          region: { x: 0, y: 0, width: 0, height: 0 } as TextureRegion,
          xAdvance: spaceGlyph.advance,
          bearingX: 0,
          bearingY: 0,
          width: 0,
          height: 0,
        };
        glyphs.set(32, spaceGlyphData);
      }

      // Generate kerning pairs
      const commonPairs = this.generateCommonKerningPairs(uniqueChars);
      for (const [first, second] of commonPairs) {
        const kerningValue = this.calculateKerning(first, second, tempCanvasResult.ctx);
        if (Math.abs(kerningValue) > 0.5) {
          const firstCode = first.codePointAt(0) || first.charCodeAt(0);
          const secondCode = second.codePointAt(0) || second.charCodeAt(0);
          const key = `${firstCode},${secondCode}`;
          kerning.set(key, Math.round(kerningValue));
        }
      }

      // Copy canvas data to bitmap
      const imageData = tempCanvasResult.ctx.getImageData(0, 0, atlasWidth, atlasHeight);
      this.copyImageDataToBitmap(imageData, atlasBitmap);

      // Set the bitmap data to the font
      font.setBitmapData(atlasBitmap, glyphs, kerning, fontMetrics.ascent, fontMetrics.descent);

      this.logger.success(
        `File font atlas generated: ${font.charset.length} glyphs, ${atlasWidth}x${atlasHeight}px`
      );

    } finally {
      // Return canvas to pool
      tempCanvasResult.dispose();
      
      // Clean up font face if needed
      if (fontFace) {
        this.fontLoader.removeFont(fontFace);
      }
    }
  }

  /**
   * Calculate padding needed for effects
   */
  private calculateEffectPadding(effects: FontEffectConfig[]): number {
    let maxPadding = 0;

    for (const effect of effects) {
      switch (effect.type) {
        case FontEffect.OUTLINE:
          maxPadding = Math.max(maxPadding, effect.thickness || 1);
          break;
        case FontEffect.SHADOW:
          const shadowX = Math.abs(effect.offsetX || 2);
          const shadowY = Math.abs(effect.offsetY || 2);
          maxPadding = Math.max(maxPadding, Math.max(shadowX, shadowY));
          break;
        case FontEffect.GLOW:
          maxPadding = Math.max(maxPadding, effect.thickness || 2);
          break;
      }
    }

    return maxPadding;
  }

  /**
   * Generate character bitmap from pattern with effects
   */
  private generatePatternCharacterBitmap(
    _char: string,
    pattern: number[],
    charWidth: number,
    charHeight: number,
    effectiveWidth: number,
    effectiveHeight: number,
    baseColor: Color32,
    effects: FontEffectConfig[],
    effectPadding: number
  ): Bitmap {
    // Create bitmap for this character
    const bitmap = Bitmap.create(effectiveWidth, effectiveHeight);
    const data32 = bitmap.data32;

    // Clear bitmap
    data32.fill(0);

    // Apply effects first (bottom to top)
    for (const effect of effects) {
      this.applyPatternEffect(data32, effectiveWidth, effectiveHeight, pattern, charWidth, charHeight, effect, effectPadding);
    }

    // Draw base glyph on top
    this.drawPatternToBitmap(
      data32, 
      effectiveWidth, 
      effectiveHeight, 
      pattern, 
      charWidth,
      charHeight,
      baseColor, 
      effectPadding, 
      effectPadding
    );

    return bitmap;
  }

  /**
   * Apply effect to pattern-based glyph
   */
  private applyPatternEffect(
    data32: Uint32Array, 
    bitmapWidth: number, 
    bitmapHeight: number, 
    pattern: number[], 
    charWidth: number,
    charHeight: number,
    effect: FontEffectConfig,
    effectPadding: number
  ): void {
    switch (effect.type) {
      case FontEffect.OUTLINE:
        this.applyPatternOutlineEffect(data32, bitmapWidth, bitmapHeight, pattern, charWidth, charHeight, effect, effectPadding);
        break;
      case FontEffect.SHADOW:
        this.applyPatternShadowEffect(data32, bitmapWidth, bitmapHeight, pattern, charWidth, charHeight, effect, effectPadding);
        break;
      case FontEffect.GLOW:
        this.applyPatternGlowEffect(data32, bitmapWidth, bitmapHeight, pattern, charWidth, charHeight, effect, effectPadding);
        break;
    }
  }

  /**
   * Apply outline effect to pattern
   */
  private applyPatternOutlineEffect(
    data32: Uint32Array, 
    bitmapWidth: number, 
    bitmapHeight: number, 
    pattern: number[], 
    charWidth: number,
    charHeight: number,
    effect: FontEffectConfig,
    effectPadding: number
  ): void {
    const thickness = effect.thickness || 1;
    const tempBitmap = new Uint32Array(data32.length);
    
    // First draw the base pattern at center
    this.drawPatternToBitmap(
      tempBitmap, 
      bitmapWidth, 
      bitmapHeight, 
      pattern, 
      charWidth,
      charHeight,
      0xFFFFFFFF, // Temporary white for outline detection
      effectPadding, 
      effectPadding
    );

    // Generate outline by expanding pixels
    for (let y = 0; y < bitmapHeight; y++) {
      for (let x = 0; x < bitmapWidth; x++) {
        const index = y * bitmapWidth + x;
        
        if (tempBitmap[index] === 0) { // If pixel is empty
          // Check surrounding pixels for outline
          let hasNeighbor = false;
          
          for (let dy = -thickness; dy <= thickness && !hasNeighbor; dy++) {
            for (let dx = -thickness; dx <= thickness && !hasNeighbor; dx++) {
              if (dx === 0 && dy === 0) continue;
              
              const checkX = x + dx;
              const checkY = y + dy;
              
              if (checkX >= 0 && checkX < bitmapWidth && checkY >= 0 && checkY < bitmapHeight) {
                const checkIndex = checkY * bitmapWidth + checkX;
                if (tempBitmap[checkIndex] !== 0) {
                  hasNeighbor = true;
                }
              }
            }
          }
          
          if (hasNeighbor) {
            data32[index] = effect.color;
          }
        }
      }
    }
  }

  /**
   * Apply shadow effect to pattern
   */
  private applyPatternShadowEffect(
    data32: Uint32Array, 
    bitmapWidth: number, 
    bitmapHeight: number, 
    pattern: number[], 
    charWidth: number,
    charHeight: number,
    effect: FontEffectConfig,
    effectPadding: number
  ): void {
    const offsetX = effect.offsetX || 2;
    const offsetY = effect.offsetY || 2;
    
    this.drawPatternToBitmap(
      data32, 
      bitmapWidth, 
      bitmapHeight, 
      pattern, 
      charWidth,
      charHeight,
      effect.color,
      effectPadding + offsetX, 
      effectPadding + offsetY
    );
  }

  /**
   * Apply glow effect to pattern
   */
  private applyPatternGlowEffect(
    data32: Uint32Array, 
    bitmapWidth: number, 
    bitmapHeight: number, 
    pattern: number[], 
    charWidth: number,
    charHeight: number,
    effect: FontEffectConfig,
    effectPadding: number
  ): void {
    const thickness = effect.thickness || 2;
    const tempBitmap = new Uint32Array(data32.length);
    
    // Draw base pattern
    this.drawPatternToBitmap(
      tempBitmap, 
      bitmapWidth, 
      bitmapHeight, 
      pattern, 
      charWidth,
      charHeight,
      0xFFFFFFFF,
      effectPadding, 
      effectPadding
    );

    // Create glow by expanding with decreasing opacity
    for (let radius = thickness; radius > 0; radius--) {
      for (let y = 0; y < bitmapHeight; y++) {
        for (let x = 0; x < bitmapWidth; x++) {
          const index = y * bitmapWidth + x;
          
          if (data32[index] === 0 && tempBitmap[index] === 0) {
            // Check if within glow radius of any pixel
            let minDistance = Infinity;
            
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                const checkX = x + dx;
                const checkY = y + dy;
                
                if (checkX >= 0 && checkX < bitmapWidth && checkY >= 0 && checkY < bitmapHeight) {
                  const checkIndex = checkY * bitmapWidth + checkX;
                  if (tempBitmap[checkIndex] !== 0) {
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    minDistance = Math.min(minDistance, distance);
                  }
                }
              }
            }
            
            if (minDistance <= radius) {
              // Apply glow with alpha based on distance
              const alpha = Math.floor((1 - minDistance / thickness) * 255);
              const glowColor = (effect.color & 0x00FFFFFF) | (alpha << 24);
              data32[index] = glowColor;
            }
          }
        }
      }
    }
  }

  /**
   * Draw bit pattern to bitmap data32 array with offset
   */
  private drawPatternToBitmap(
    data32: Uint32Array, 
    bitmapWidth: number, 
    bitmapHeight: number, 
    pattern: number[], 
    charWidth: number,
    charHeight: number,
    color: Color32, 
    offsetX: number = 0, 
    offsetY: number = 0
  ): void {
    for (let row = 0; row < charHeight && row < pattern.length; row++) {
      const rowPattern = pattern[row];
      const y = offsetY + row;
      
      if (y >= 0 && y < bitmapHeight) {
        const rowStart = y * bitmapWidth;
        
        for (let col = 0; col < charWidth; col++) {
          const bit = (rowPattern >> (charWidth - 1 - col)) & 1;
          if (bit) {
            const x = offsetX + col;
            if (x >= 0 && x < bitmapWidth) {
              data32[rowStart + x] = color;
            }
          }
        }
      }
    }
  }

  /**
   * Draw bitmap to atlas
   */
  private drawBitmapToAtlas(
    atlasData: Uint32Array,
    atlasWidth: number,
    startX: number,
    startY: number,
    bitmapData: Uint32Array,
    bitmapWidth: number,
    bitmapHeight: number
  ): void {
    for (let y = 0; y < bitmapHeight; y++) {
      for (let x = 0; x < bitmapWidth; x++) {
        const srcIndex = y * bitmapWidth + x;
        const srcPixel = bitmapData[srcIndex];
        
        if (srcPixel !== 0) { // Only draw non-transparent pixels
          const destX = startX + x;
          const destY = startY + y;
          const destIndex = destY * atlasWidth + destX;
          atlasData[destIndex] = srcPixel;
        }
      }
    }
  }

  /**
   * Render glyph with effects to canvas context
   */
  private renderGlyphWithEffects(
    ctx: CanvasRenderingContext2D,
    char: string,
    x: number,
    y: number,
    baseColor: Color32,
    effects: FontEffectConfig[]
  ): void {
    // Apply effects first (bottom to top)
    for (const effect of effects) {
      this.applyCanvasEffect(ctx, char, x, y, effect);
    }

    // Draw base glyph on top
    ctx.fillStyle = this.color32ToCSS(baseColor);
    ctx.fillText(char, x, y);
  }

  /**
   * Apply effect to canvas-rendered glyph
   */
  private applyCanvasEffect(
    ctx: CanvasRenderingContext2D,
    char: string,
    x: number,
    y: number,
    effect: FontEffectConfig
  ): void {
    const effectColor = this.color32ToCSS(effect.color);
    
    switch (effect.type) {
      case FontEffect.OUTLINE:
        ctx.strokeStyle = effectColor;
        ctx.lineWidth = (effect.thickness || 1) * 2;
        ctx.strokeText(char, x, y);
        break;
        
      case FontEffect.SHADOW:
        ctx.fillStyle = effectColor;
        ctx.fillText(char, x + (effect.offsetX || 2), y + (effect.offsetY || 2));
        break;
        
      case FontEffect.GLOW:
        const thickness = effect.thickness || 2;
        ctx.shadowColor = effectColor;
        ctx.shadowBlur = thickness * 2;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = effectColor;
        ctx.fillText(char, x, y);
        ctx.shadowBlur = 0;
        break;
    }
  }

  /**
   * Convert Color32 to CSS color string
   */
  private color32ToCSS(color: Color32): string {
    const r = (color >> 0) & 0xFF;
    const g = (color >> 8) & 0xFF;
    const b = (color >> 16) & 0xFF;
    const a = (color >> 24) & 0xFF;
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  }

  /**
   * Copy ImageData to Bitmap
   */
  private copyImageDataToBitmap(imageData: ImageData, bitmap: Bitmap): void {
    const srcData = imageData.data;
    const dstData = bitmap.data8;
    
    for (let i = 0; i < srcData.length; i++) {
      dstData[i] = srcData[i];
    }
  }

  /**
   * Font rendering presets for common use cases
   */
  private getFontRenderingPresets(): Record<string, FontRenderingOptions> {
    return {
      pixelPerfect: {
        antiAliasing: false,
        textRenderingOptimization: "optimizeLegibility",
      },
      antialiased: {
        antiAliasing: true,
        textRenderingOptimization: "optimizeLegibility",
      },
      subPixelAntialiased: {
        antiAliasing: true,
        textRenderingOptimization: "geometricPrecision",
      },
    };
  }

  /**
   * Setup canvas for font rendering
   */
  private setupCanvasForFontRendering(
    ctx: CanvasRenderingContext2D,
    fontString: string,
    antiAliasing: boolean,
    textRenderingOptimization: string
  ): void {
    ctx.font = fontString;
    ctx.imageSmoothingEnabled = antiAliasing;
    if (antiAliasing) {
      ctx.imageSmoothingQuality = "high";
    }
    ctx.textRendering = textRenderingOptimization;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
  }

  /**
   * Measure font-level metrics using HTML5 Canvas TextMetrics
   */
  private measureFontMetrics(
    ctx: CanvasRenderingContext2D,
    fontSize: number,
    charset: string
  ): { ascent: number; descent: number; lineGap: number } {
    // Implementation similar to FileFont.measureFontMetrics
    let maxActualAscent = 0;
    let maxActualDescent = 0;
    let fontBoundingBoxAscent = 0;
    let fontBoundingBoxDescent = 0;

    const referenceChar = charset[0] || "M";
    const referenceMetrics = ctx.measureText(referenceChar);

    fontBoundingBoxAscent = referenceMetrics.fontBoundingBoxAscent ?? 0;
    fontBoundingBoxDescent = referenceMetrics.fontBoundingBoxDescent ?? 0;

    const characters = this.splitGraphemes(charset);
    const uniqueChars = Array.from(new Set(characters)).filter(
      (char) => char.length > 0 && char !== " "
    );

    for (const char of uniqueChars) {
      const metrics = ctx.measureText(char);
      const actualAscent = metrics.actualBoundingBoxAscent ?? 0;
      const actualDescent = metrics.actualBoundingBoxDescent ?? 0;

      maxActualAscent = Math.max(maxActualAscent, actualAscent);
      maxActualDescent = Math.max(maxActualDescent, actualDescent);
    }

    let finalAscent = fontBoundingBoxAscent || maxActualAscent || fontSize * 0.8;
    let finalDescent = fontBoundingBoxDescent || maxActualDescent || fontSize * 0.2;

    finalAscent = Math.max(finalAscent, fontSize * 0.6);
    finalDescent = Math.max(finalDescent, fontSize * 0.15);

    const lineGap = fontSize * 0.2;

    return {
      ascent: Math.round(finalAscent),
      descent: Math.round(finalDescent),
      lineGap: Math.round(lineGap),
    };
  }

  /**
   * Measure glyph metrics using HTML5 Canvas TextMetrics
   */
  private measureGlyph(
    char: string,
    ctx: CanvasRenderingContext2D,
    fontSize: number
  ): GlyphMetrics {
    const metrics = ctx.measureText(char);
    const charCode = char.codePointAt(0) || char.charCodeAt(0);

    const actualBoundingBoxLeft = metrics.actualBoundingBoxLeft ?? 0;
    const actualBoundingBoxRight = metrics.actualBoundingBoxRight ?? (metrics.width || 0);
    const actualBoundingBoxAscent = metrics.actualBoundingBoxAscent ?? metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
    const actualBoundingBoxDescent = metrics.actualBoundingBoxDescent ?? metrics.fontBoundingBoxDescent ?? fontSize * 0.2;

    const glyphWidth = Math.max(0, Math.round(actualBoundingBoxRight - actualBoundingBoxLeft));
    const glyphHeight = Math.max(0, Math.round(actualBoundingBoxAscent + actualBoundingBoxDescent));

    const advance = Math.round(metrics.width || 0);
    const bearingX = Math.round(actualBoundingBoxLeft);
    const bearingY = Math.round(actualBoundingBoxAscent);

    return {
      char,
      charCode,
      width: glyphWidth,
      height: glyphHeight,
      bearingX: bearingX,
      bearingY: bearingY,
      advance: advance,
    };
  }

  /**
   * Calculate kerning between two characters using canvas context
   */
  private calculateKerning(
    firstChar: string,
    secondChar: string,
    ctx: CanvasRenderingContext2D
  ): number {
    const firstWidth = ctx.measureText(firstChar).width;
    const secondWidth = ctx.measureText(secondChar).width;
    const combinedWidth = ctx.measureText(firstChar + secondChar).width;

    const expectedWidth = firstWidth + secondWidth;
    const actualWidth = combinedWidth;

    return actualWidth - expectedWidth;
  }

  /**
   * Pack glyphs using bin packing algorithm
   */
  private packGlyphs(
    glyphs: GlyphMetrics[],
    maxWidth: number = 2048
  ): { packed: Array<{ glyph: GlyphMetrics; x: number; y: number; width: number; height: number }>; width: number; height: number } {
    if (glyphs.length === 0) {
      return { packed: [], width: 256, height: 256 };
    }

    // Sort glyphs by height (descending) then by width (descending) for better packing
    const sortedGlyphs = [...glyphs].sort((a, b) => {
      if (b.height !== a.height) return b.height - a.height;
      return b.width - a.width;
    });

    // Calculate initial atlas size
    const totalArea = glyphs.reduce(
      (sum, glyph) => sum + Math.max(1, glyph.width) * Math.max(1, glyph.height),
      0
    );
    const minSize = Math.max(256, Math.ceil(Math.sqrt(totalArea * 1.2)));

    const maxGlyphWidth = Math.max(1, ...glyphs.map((g) => g.width));
    const maxGlyphHeight = Math.max(1, ...glyphs.map((g) => g.height));

    let atlasWidth = Math.min(maxWidth, Math.max(minSize, maxGlyphWidth));
    let atlasHeight = Math.max(256, maxGlyphHeight);

    let packed: Array<{ glyph: GlyphMetrics; x: number; y: number; width: number; height: number }> = [];
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const root = new PackingNode(0, 0, atlasWidth, atlasHeight);
      packed = [];
      let success = true;

      for (const glyph of sortedGlyphs) {
        const node = root.insert(glyph.width, glyph.height);
        if (!node) {
          success = false;
          break;
        }

        packed.push({
          glyph,
          x: node.x,
          y: node.y,
          width: glyph.width,
          height: glyph.height,
        });
      }

      if (success) {
        const usedHeight = packed.length > 0
          ? Math.max(...packed.map((p) => p.y + p.height))
          : 256;
        return { packed, width: atlasWidth, height: Math.max(256, usedHeight) };
      }

      attempts++;
      if (atlasWidth < maxWidth) {
        atlasWidth = Math.min(maxWidth, Math.floor(atlasWidth * 1.5));
      } else {
        atlasHeight = Math.floor(atlasHeight * 1.5);
      }
    }

    throw new Error("Failed to pack glyphs into atlas after multiple attempts");
  }

  /**
   * Generate common kerning pairs
   */
  private generateCommonKerningPairs(characters: string[]): [string, string][] {
    const pairs: [string, string][] = [];

    const addPair = (first: string, second: string) => {
      if (characters.includes(first) && characters.includes(second)) {
        pairs.push([first, second]);
      }
    };

    const kerningCombos = [
      ["A", "V"], ["A", "W"], ["A", "Y"], ["A", "T"],
      ["V", "A"], ["W", "A"], ["Y", "A"], ["T", "A"],
      ["L", "T"], ["L", "V"], ["L", "W"], ["L", "Y"],
      ["P", "A"], ["R", "A"], ["F", "A"],
      ["r", "a"], ["r", "e"], ["r", "o"], ["r", "u"],
      ["f", "a"], ["f", "e"], ["f", "o"], ["f", "u"],
      ["v", "a"], ["v", "e"], ["v", "o"], ["v", "u"],
      ["w", "a"], ["w", "e"], ["w", "o"], ["w", "u"],
      ["y", "a"], ["y", "e"], ["y", "o"], ["y", "u"],
      ["T", "o"], ["T", "e"], ["T", "a"], ["T", "u"],
      ["V", "o"], ["V", "e"], ["V", "a"], ["V", "u"],
      ["W", "o"], ["W", "e"], ["W", "a"], ["W", "u"],
      ["Y", "o"], ["Y", "e"], ["Y", "a"], ["Y", "u"],
    ];

    for (const [first, second] of kerningCombos) {
      addPair(first, second);
    }

    return pairs;
  }

  /**
   * Split text into grapheme clusters
   */
  private splitGraphemes(text: string): string[] {
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
}