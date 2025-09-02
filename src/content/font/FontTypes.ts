// FontTypes.ts - Common font types and interfaces

import { Color32 } from "../../graphics/Color32";

/**
 * Character pattern data - each number represents a row of 8 bits
 */
export interface CharacterPattern {
  [charCode: number]: number[];
}

/**
 * Text effect types for fonts
 */
export enum FontEffect {
  OUTLINE = 'outline',
  SHADOW = 'shadow',
  GLOW = 'glow'
}

/**
 * Effect configuration
 */
export interface FontEffectConfig {
  type: FontEffect;
  color: Color32;
  offsetX?: number;
  offsetY?: number;
  thickness?: number;
}

/**
 * Font style options for file-based fonts
 */
export interface FontStyle {
  weight?: string;
  style?: string;
  variant?: string;
}

/**
 * Font rendering options for file-based fonts
 */
export interface FontRenderingOptions {
  antiAliasing?: boolean;
  textRenderingOptimization?:
    | "speed"
    | "optimizeSpeed"
    | "optimizeLegibility"
    | "geometricPrecision";
  preset?: "pixelPerfect" | "antialiased" | "subPixelAntialiased";
}

/**
 * Charset preset options
 */
export interface CharsetPreset {
  preset: "latin-basic" | "latin-extended";
}

/**
 * Glyph metrics based on HTML5 Canvas TextMetrics
 */
export interface GlyphMetrics {
  char: string;
  charCode: number;
  width: number;
  height: number;
  bearingX: number;
  bearingY: number;
  advance: number;
}

/**
 * Font asset definition for JSON configuration (backwards compatibility)
 */
export interface FontDefinition {
  fontFamily: string;
  fontSize: number;
  fontStyle?: FontStyle;
  charset?: string | CharsetPreset;
  source: "native" | "file";
  path: string;
  rendering?: FontRenderingOptions;
}