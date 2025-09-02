// Color.ts - Efficient color representation using packed RGBA integer with Flyweight pattern

import { ColorUtils } from "./ColorUtils";

export class Color {
  private _rgba: number;

  // Flyweight factory cache for color instances
  private static colorCache: Map<number, Color> = new Map();

  private constructor() {
    this._rgba = 0;
  }

  /**
   * Create a Color from individual RGBA components (0-1 range) - Flyweight factory method
   */
  static fromRGBA(r: number, g: number, b: number, a: number = 1): Color {
    // Calculate the packed RGBA value using ColorUtils
    const packedRGBA = ColorUtils.packRGBA(r, g, b, a);

    // Check if this color already exists in the cache
    if (!Color.colorCache.has(packedRGBA)) {
      const color = new Color();
      color._rgba = packedRGBA;
      Color.colorCache.set(packedRGBA, color);
    }

    return Color.colorCache.get(packedRGBA)!;
  }

  /**
   * Create a Color from a packed RGBA integer - Flyweight factory method
   */
  static fromRGBAInt(rgba: number): Color {
    // Check if this color already exists in the cache
    if (!Color.colorCache.has(rgba)) {
      const color = new Color();
      color._rgba = rgba;
      Color.colorCache.set(rgba, color);
    }

    return Color.colorCache.get(rgba)!;
  }

  /**
   * Create a Color from hex string (e.g., "#FF0000" or "FF0000") - Flyweight factory method
   */
  static fromHex(hex: string): Color {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    const a =
      cleanHex.length === 8 ? parseInt(cleanHex.substring(6, 8), 16) / 255 : 1;

    // Use the flyweight factory method
    return Color.fromRGBA(r, g, b, a);
  }

  /**
   * Create a Color from HSV values - Flyweight factory method
   * @param h Hue (0-360 degrees)
   * @param s Saturation (0-1 range)
   * @param v Value/Brightness (0-1 range)
   * @param a Alpha (0-1 range, optional, defaults to 1)
   */
  static fromHSV(h: number, s: number, v: number, a: number = 1): Color {
    // Normalize hue to 0-360 range
    h = ((h % 360) + 360) % 360;

    // Clamp saturation, value, and alpha to 0-1 range
    s = Math.max(0, Math.min(1, s));
    v = Math.max(0, Math.min(1, v));
    a = Math.max(0, Math.min(1, a));

    // Convert HSV to RGB
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0,
      g = 0,
      b = 0;

    if (h >= 0 && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h >= 60 && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h >= 180 && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h >= 240 && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else if (h >= 300 && h < 360) {
      r = c;
      g = 0;
      b = x;
    }

    // Use the flyweight factory method
    return Color.fromRGBA(r + m, g + m, b + m, a);
  }

  /**
   * Get the packed RGBA integer value
   */
  get rgba(): number {
    return this._rgba >>> 0; // Force unsigned 32-bit integer
  }

  /**
   * Get red component (0-1 range)
   */
  get r(): number {
    return ((this._rgba >>> 0) & 0xff) / 255;
  }

  /**
   * Get green component (0-1 range)
   */
  get g(): number {
    return ((this._rgba >>> 8) & 0xff) / 255;
  }

  /**
   * Get blue component (0-1 range)
   */
  get b(): number {
    return ((this._rgba >>> 16) & 0xff) / 255;
  }

  /**
   * Get alpha component (0-1 range)
   */
  get a(): number {
    return ((this._rgba >>> 24) & 0xff) / 255;
  }

  /**
   * Create a new Color with modified red component (returns flyweight instance)
   */
  withR(value: number): Color {
    const rgba = this._rgba;
    return Color.fromRGBA(
      value,
      ((rgba >>> 8) & 0xff) / 255,
      ((rgba >>> 16) & 0xff) / 255,
      ((rgba >>> 24) & 0xff) / 255
    );
  }

  /**
   * Create a new Color with modified green component (returns flyweight instance)
   */
  withG(value: number): Color {
    const rgba = this._rgba;
    return Color.fromRGBA(
      ((rgba >>> 0) & 0xff) / 255,
      value,
      ((rgba >>> 16) & 0xff) / 255,
      ((rgba >>> 24) & 0xff) / 255
    );
  }

  /**
   * Create a new Color with modified blue component (returns flyweight instance)
   */
  withB(value: number): Color {
    const rgba = this._rgba;
    return Color.fromRGBA(
      ((rgba >>> 0) & 0xff) / 255,
      ((rgba >>> 8) & 0xff) / 255,
      value,
      ((rgba >>> 24) & 0xff) / 255
    );
  }

  /**
   * Create a new Color with modified alpha component (returns flyweight instance)
   */
  withA(value: number): Color {
    const rgba = this._rgba;
    return Color.fromRGBA(
      ((rgba >>> 0) & 0xff) / 255,
      ((rgba >>> 8) & 0xff) / 255,
      ((rgba >>> 16) & 0xff) / 255,
      value
    );
  }

  /**
   * Create a new Color with modified RGBA components (returns flyweight instance)
   */
  withRGBA(r?: number, g?: number, b?: number, a?: number): Color {
    const rgba = this._rgba;
    return Color.fromRGBA(
      r !== undefined ? r : ((rgba >>> 0) & 0xff) / 255,
      g !== undefined ? g : ((rgba >>> 8) & 0xff) / 255,
      b !== undefined ? b : ((rgba >>> 16) & 0xff) / 255,
      a !== undefined ? a : ((rgba >>> 24) & 0xff) / 255
    );
  }

  /**
   * Get hex string representation
   */
  toHex(includeAlpha: boolean = false): string {
    const rgba = this._rgba;
    const rHex = ((rgba >>> 0) & 0xff).toString(16).padStart(2, "0");
    const gHex = ((rgba >>> 8) & 0xff).toString(16).padStart(2, "0");
    const bHex = ((rgba >>> 16) & 0xff).toString(16).padStart(2, "0");

    if (includeAlpha) {
      const aHex = ((rgba >>> 24) & 0xff).toString(16).padStart(2, "0");
      return `#${rHex}${gHex}${bHex}${aHex}`;
    }

    return `#${rHex}${gHex}${bHex}`;
  }

  /**
   * Check if this color equals another color
   */
  equals(other: Color): boolean {
    return this._rgba === other._rgba;
  }

  /**
   * Create a copy of this color (returns the same flyweight instance since colors are immutable)
   */
  clone(): Color {
    return Color.fromRGBAInt(this._rgba);
  }

  /**
   * String representation
   */
  toString(): string {
    const rgba = this._rgba;
    const r = (((rgba >>> 0) & 0xff) / 255).toFixed(3);
    const g = (((rgba >>> 8) & 0xff) / 255).toFixed(3);
    const b = (((rgba >>> 16) & 0xff) / 255).toFixed(3);
    const a = (((rgba >>> 24) & 0xff) / 255).toFixed(3);
    return `Color(r=${r}, g=${g}, b=${b}, a=${a})`;
  }

  /**
   * Get the number of cached color instances (for debugging/monitoring)
   */
  static getCacheSize(): number {
    return Color.colorCache.size;
  }

  // Common color constants - these will be flyweight instances
  static readonly BLACK = Color.fromRGBA(0, 0, 0, 1);
  static readonly WHITE = Color.fromRGBA(1, 1, 1, 1);
  static readonly RED = Color.fromRGBA(1, 0, 0, 1);
  static readonly GREEN = Color.fromRGBA(0, 1, 0, 1);
  static readonly BLUE = Color.fromRGBA(0, 0, 1, 1);
  static readonly YELLOW = Color.fromRGBA(1, 1, 0, 1);
  static readonly CYAN = Color.fromRGBA(0, 1, 1, 1);
  static readonly MAGENTA = Color.fromRGBA(1, 0, 1, 1);
  static readonly PURPLE = Color.fromRGBA(0.5, 0, 0.5, 1);
  static readonly PINK = Color.fromRGBA(1, 0.75, 0.8, 1);
  static readonly ORANGE = Color.fromRGBA(1, 0.65, 0, 1);
  static readonly BROWN = Color.fromRGBA(0.65, 0.16, 0.16, 1);
  static readonly GRAY = Color.fromRGBA(0.5, 0.5, 0.5, 1);
  static readonly LIGHT_GRAY = Color.fromRGBA(0.75, 0.75, 0.75, 1);
  static readonly DARK_GRAY = Color.fromRGBA(0.25, 0.25, 0.25, 1);
  static readonly NAVY = Color.fromRGBA(0, 0, 0.5, 1);
  static readonly MAROON = Color.fromRGBA(0.5, 0, 0, 1);
  static readonly OLIVE = Color.fromRGBA(0.5, 0.5, 0, 1);
  static readonly TEAL = Color.fromRGBA(0, 0.5, 0.5, 1);
  static readonly SILVER = Color.fromRGBA(0.75, 0.75, 0.75, 1);
  static readonly TRANSPARENT = Color.fromRGBA(0, 0, 0, 0);

  /**
   * Serialize Color to JSON as hex string
   */
  toJSON(): string {
    return this.toHex();
  }

  /**
   * Deserialize Color from JSON hex string
   */
  static fromJSON(hex: string): Color {
    return Color.fromHex(hex);
  }
}
