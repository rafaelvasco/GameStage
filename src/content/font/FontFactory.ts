// FontFactory.ts - Factory class for creating fonts with the unified architecture

import { Font } from "./Font";
import { FontAtlasBlitter, PatternFontConfig, FileFontConfig } from "./FontAtlasBlitter";
import { CharacterPattern, FontEffect, FontEffectConfig, FontStyle, FontRenderingOptions, CharsetPreset, FontDefinition } from "./FontTypes";

/**
 * Configuration for creating pattern-based fonts
 */
export interface CreatePatternFontConfig {
  id: string;
  characterPatterns: CharacterPattern;
  charWidth: number;
  charHeight: number;
  fontSize: number;
  charset?: string | CharsetPreset;
  atlasCols?: number;
  atlasRows?: number;
  spacing?: number;
  baseColor?: number; // Color32
  effects?: FontEffectConfig[];
}

/**
 * Configuration for creating file-based fonts
 */
export interface CreateFileFontConfig {
  id: string;
  fontFamily: string;
  fontSize: number;
  fontStyle?: FontStyle;
  charset?: string | CharsetPreset;
  source: "native" | "file";
  path: string;
  rendering?: FontRenderingOptions;
  baseColor?: number; // Color32
  effects?: FontEffectConfig[];
}


/**
 * FontFactory class for creating fonts with the unified architecture
 * Uses FontAtlasBlitter internally to generate font atlases
 */
export class FontFactory {
  private static atlasBlitter = new FontAtlasBlitter();

  /**
   * Create a pattern-based font from character patterns
   * This font can be used with both Canvas (GPU texture) and Blitter (software bitmap) rendering
   */
  static async createPatternFont(config: CreatePatternFontConfig): Promise<Font> {
    // Validate configuration
    if (!FontFactory.validatePatternFontConfig(config)) {
      throw new Error('Invalid pattern font configuration');
    }

    // Create font instance
    const font = new Font(
      config.id,
      config.fontSize,
      config.charset,
      null // No file path for pattern fonts
    );

    // Build atlas configuration
    const atlasConfig: PatternFontConfig = {
      type: 'pattern',
      characterPatterns: config.characterPatterns,
      charWidth: config.charWidth,
      charHeight: config.charHeight,
      atlasCols: config.atlasCols,
      atlasRows: config.atlasRows,
      spacing: config.spacing,
      baseColor: config.baseColor,
      effects: config.effects
    };

    // Build the font atlas
    await FontFactory.atlasBlitter.buildFontAtlas(font, atlasConfig);

    return font;
  }

  /**
   * Create a file-based font from font files or native browser fonts
   * This font can be used with both Canvas (GPU texture) and Blitter (software bitmap) rendering
   */
  static async createFileFont(config: CreateFileFontConfig): Promise<Font> {
    // Validate configuration
    if (!FontFactory.validateFileFontConfig(config)) {
      throw new Error('Invalid file font configuration');
    }

    // Create font instance
    const font = new Font(
      config.id,
      config.fontSize,
      config.charset,
      config.path
    );

    // Build atlas configuration
    const atlasConfig: FileFontConfig = {
      type: 'file',
      fontFamily: config.fontFamily,
      fontStyle: config.fontStyle,
      source: config.source,
      path: config.path,
      rendering: config.rendering,
      baseColor: config.baseColor,
      effects: config.effects
    };

    // Build the font atlas
    await FontFactory.atlasBlitter.buildFontAtlas(font, atlasConfig);

    return font;
  }

  /**
   * Create a font from configuration object
   * Automatically determines the font type based on the configuration
   */
  static async createFont(config: CreatePatternFontConfig | CreateFileFontConfig): Promise<Font> {
    if ('characterPatterns' in config) {
      return FontFactory.createPatternFont(config as CreatePatternFontConfig);
    } else if ('fontFamily' in config) {
      return FontFactory.createFileFont(config as CreateFileFontConfig);
    } else {
      throw new Error('Invalid font configuration: must specify either characterPatterns or fontFamily');
    }
  }

  /**
   * Create a file font from a legacy FontDefinition (backwards compatibility)
   */
  static async createFileFontFromDefinition(id: string, definition: FontDefinition, charset?: string | CharsetPreset): Promise<Font> {
    const config: CreateFileFontConfig = {
      id,
      fontFamily: definition.fontFamily,
      fontSize: definition.fontSize,
      fontStyle: definition.fontStyle,
      charset: charset || definition.charset,
      source: definition.source,
      path: definition.path,
      rendering: definition.rendering
    };

    return FontFactory.createFileFont(config);
  }

  /**
   * Create a simple pattern font with default settings
   */
  static async createSimplePatternFont(
    id: string,
    characterPatterns: CharacterPattern,
    charWidth: number,
    charHeight: number,
    fontSize: number,
    charset?: string | CharsetPreset
  ): Promise<Font> {
    const config: CreatePatternFontConfig = {
      id,
      characterPatterns,
      charWidth,
      charHeight,
      fontSize,
      charset
    };

    return FontFactory.createPatternFont(config);
  }

  /**
   * Create a simple file font with default settings
   */
  static async createSimpleFileFont(
    id: string,
    fontFamily: string,
    fontSize: number,
    source: "native" | "file" = "native",
    path: string = "",
    charset?: string | CharsetPreset
  ): Promise<Font> {
    const config: CreateFileFontConfig = {
      id,
      fontFamily,
      fontSize,
      source,
      path,
      charset
    };

    return FontFactory.createFileFont(config);
  }

  /**
   * Add effects to an existing font configuration
   */
  static addEffectsToConfig<T extends CreatePatternFontConfig | CreateFileFontConfig>(
    config: T,
    effects: FontEffectConfig[]
  ): T {
    return {
      ...config,
      effects: [...(config.effects || []), ...effects]
    };
  }

  /**
   * Create common effect configurations
   */
  static createOutlineEffect(color: number, thickness: number = 1): FontEffectConfig {
    return {
      type: FontEffect.OUTLINE,
      color,
      thickness
    };
  }

  static createShadowEffect(color: number, offsetX: number = 2, offsetY: number = 2): FontEffectConfig {
    return {
      type: FontEffect.SHADOW,
      color,
      offsetX,
      offsetY
    };
  }

  static createGlowEffect(color: number, thickness: number = 2): FontEffectConfig {
    return {
      type: FontEffect.GLOW,
      color,
      thickness
    };
  }

  /**
   * Validate pattern font configuration
   */
  static validatePatternFontConfig(config: CreatePatternFontConfig): boolean {
    if (!config.id || typeof config.id !== 'string') {
      return false;
    }
    
    if (!config.characterPatterns || typeof config.characterPatterns !== 'object') {
      return false;
    }
    
    if (!config.charWidth || !config.charHeight || !config.fontSize ||
        config.charWidth <= 0 || config.charHeight <= 0 || config.fontSize <= 0) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate file font configuration
   */
  static validateFileFontConfig(config: CreateFileFontConfig): boolean {
    if (!config.id || typeof config.id !== 'string') {
      return false;
    }
    
    if (!config.fontFamily || typeof config.fontFamily !== 'string') {
      return false;
    }

    if (!config.fontSize || config.fontSize <= 0) {
      return false;
    }

    if (!["native", "file"].includes(config.source)) {
      return false;
    }

    if (config.source === "file" && !config.path) {
      return false;
    }

    if (config.charset !== undefined) {
      if (typeof config.charset === "string") {
        // String charset is valid
      } else if (
        typeof config.charset === "object" &&
        config.charset.preset
      ) {
        const validPresets = ["latin-basic", "latin-extended"];
        if (!validPresets.includes(config.charset.preset)) {
          return false;
        }
      } else {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Validate a legacy font definition object
   */
  static validateDefinition(definition: any): definition is FontDefinition {
    if (!definition || typeof definition !== "object") {
      return false;
    }

    const required = ["fontFamily", "fontSize", "source"];
    for (const field of required) {
      if (!(field in definition)) {
        return false;
      }
    }

    if (!definition.path) {
      return false;
    }

    if (typeof definition.fontSize !== "number" || definition.fontSize <= 0) {
      return false;
    }

    if (!["native", "file"].includes(definition.source)) {
      return false;
    }

    if (definition.charset !== undefined) {
      if (typeof definition.charset === "string") {
        // String charset is valid
      } else if (
        typeof definition.charset === "object" &&
        definition.charset.preset
      ) {
        const validPresets = ["latin-basic", "latin-extended"];
        if (!validPresets.includes(definition.charset.preset)) {
          return false;
        }
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * Get supported font types
   */
  static getSupportedFontTypes(): string[] {
    return ['pattern', 'file'];
  }

  /**
   * Check if a font type is supported
   */
  static isFontTypeSupported(type: string): boolean {
    return FontFactory.getSupportedFontTypes().includes(type.toLowerCase());
  }

  /**
   * Get available font effects
   */
  static getAvailableEffects(): string[] {
    return Object.values(FontEffect);
  }

  /**
   * Check if an effect type is supported
   */
  static isEffectSupported(effectType: string): boolean {
    return FontFactory.getAvailableEffects().includes(effectType);
  }

  /**
   * Get font rendering presets
   */
  static getFontRenderingPresets(): Record<string, FontRenderingOptions> {
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
   * Get available rendering presets
   */
  static getAvailableRenderingPresets(): string[] {
    return Object.keys(FontFactory.getFontRenderingPresets());
  }

  /**
   * Check if a rendering preset is supported
   */
  static isRenderingPresetSupported(preset: string): boolean {
    return FontFactory.getAvailableRenderingPresets().includes(preset);
  }
}