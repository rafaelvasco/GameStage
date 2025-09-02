/**
 * FileFontLoader - Singleton for loading fonts
 * Centralizes font loading functionality from FileFont class
 */
import { logger } from "../../utils";

export class FileFontLoader {
  private static instance: FileFontLoader | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of FileFontLoader
   */
  static getInstance(): FileFontLoader {
    if (!FileFontLoader.instance) {
      FileFontLoader.instance = new FileFontLoader();
    }
    return FileFontLoader.instance;
  }

  /**
   * Load a custom font from a file
   * @param fontFamily - The font family name
   * @param filePath - The path to the font file
   * @returns Promise that resolves to the loaded FontFace
   */
  async loadFileFont(fontFamily: string, filePath: string): Promise<FontFace> {
    try {
      const fontFace = new FontFace(fontFamily, `url(${filePath})`);
      await fontFace.load();
      document.fonts.add(fontFace);
      logger.debug(`Custom font '${fontFamily}' loaded from '${filePath}'`);
      return fontFace;
    } catch (error) {
      const errorMsg = `Failed to load custom font from '${filePath}': ${error}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Check if a font is already loaded in the document
   * @param fontFamily - The font family name to check
   * @returns True if the font is already loaded
   */
  isFontLoaded(fontFamily: string): boolean {
    return document.fonts.check(`16px ${fontFamily}`);
  }

  /**
   * Remove a font from the document
   * @param fontFace - The FontFace to remove
   */
  removeFont(fontFace: FontFace): void {
    document.fonts.delete(fontFace);
    logger.debug(`Font '${fontFace.family}' removed from document`);
  }
}