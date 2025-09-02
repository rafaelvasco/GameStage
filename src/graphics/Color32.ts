// Color32.ts - 32-bit integer color representation

/**
 * Color value as 32-bit integer (ABGR format)
 * Alpha in bits 24-31, Blue in bits 16-23, Green in bits 8-15, Red in bits 0-7
 */
export type Color32 = number;

export class Color32Utils {
  /**
   * Create a 32-bit color from RGBA components (0-255 range)
   */
  static rgba(r: number, g: number, b: number, a: number = 255): Color32 {
    return (a << 24) | (b << 16) | (g << 8) | r;
  }

  /**
   * Create a 32-bit color from RGB components (alpha = 255)
   */
  static rgb(r: number, g: number, b: number): Color32 {
    return (255 << 24) | (b << 16) | (g << 8) | r;
  }

  /**
   * Extract RGBA components from 32-bit color
   */
  static toRGBA(color: Color32): { r: number; g: number; b: number; a: number } {
    return {
      r: color & 0xFF,
      g: (color >>> 8) & 0xFF,
      b: (color >>> 16) & 0xFF,
      a: (color >>> 24) & 0xFF,
    };
  }
}