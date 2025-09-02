// DefaultFont.ts - Default bitmap font using FontFactory

import { FontFactory } from "../font/FontFactory";
import { CharacterPattern } from "../font/FontTypes";
import { Font } from "../font/Font";
import { CHARACTER_PATTERNS_HEX } from "../builtin/DefaultFontPatternsGenerated";

/**
 * DefaultFont class that generates a simple 8x8 bitmap font using pre-defined patterns
 * Contains only basic Latin characters (ASCII 32-126)
 */
export class DefaultFont {
  private static instance: Font | null = null;
  private static readonly CHAR_WIDTH = 8;
  private static readonly CHAR_HEIGHT = 8;
  private static readonly FONT_SIZE = 8;
  private static readonly ATLAS_COLS = 16;
  private static readonly ATLAS_ROWS = 6;

  /**
   * Pre-converted character patterns in optimized hexadecimal format
   */
  private static readonly CHAR_PATTERNS: CharacterPattern = (() => {
    const patterns: CharacterPattern = {};

    for (const [char, hexPattern] of Object.entries(CHARACTER_PATTERNS_HEX)) {
      const charCode = char.charCodeAt(0);
      patterns[charCode] = hexPattern;
    }

    return patterns;
  })();

  /**
   * Get the singleton default font instance
   */
  static async getInstance(): Promise<Font> {
    if (!DefaultFont.instance) {
      DefaultFont.instance = await DefaultFont.createDefaultFont();
    }
    return DefaultFont.instance;
  }

  /**
   * Create the default font using FontFactory
   */
  private static async createDefaultFont(): Promise<Font> {
    const charset = DefaultFont.getBasicLatinCharset();

    return await FontFactory.createPatternFont({
      id: "default-font",
      characterPatterns: DefaultFont.CHAR_PATTERNS,
      charWidth: DefaultFont.CHAR_WIDTH,
      charHeight: DefaultFont.CHAR_HEIGHT,
      fontSize: DefaultFont.FONT_SIZE,
      charset,
      atlasCols: DefaultFont.ATLAS_COLS,
      atlasRows: DefaultFont.ATLAS_ROWS
    });
  }

  /**
   * Get the basic Latin character set (ASCII 32-126)
   */
  private static getBasicLatinCharset(): string {
    let charset = "";
    for (let i = 32; i <= 126; i++) {
      charset += String.fromCharCode(i);
    }
    return charset;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    if (DefaultFont.instance) {
      DefaultFont.instance.dispose();
      DefaultFont.instance = null;
    }
  }

  /**
   * Get character patterns for creating custom pattern fonts
   */
  static getCharacterPatterns(): CharacterPattern {
    return { ...DefaultFont.CHAR_PATTERNS };
  }

  /**
   * Get character dimensions
   */
  static getCharacterDimensions(): { width: number; height: number } {
    return {
      width: DefaultFont.CHAR_WIDTH,
      height: DefaultFont.CHAR_HEIGHT,
    };
  }
}
