// content/index.ts - Content module exports

export { Asset } from "./Asset";
export type { AssetBundle } from "./AssetBundle";
export { AssetBundleManager } from "./AssetBundleManager";
export { Content } from "./Content";
// Font classes
export { Font } from "./font/Font";
export type { Glyph, KerningPair } from "./font/Font";
export { FontFactory } from "./font/FontFactory";
export type {
  CreatePatternFontConfig,
  CreateFileFontConfig,
} from "./font/FontFactory";
export { FontAtlasBlitter } from "./font/FontAtlasBlitter";
export type {
  PatternFontConfig,
  FileFontConfig,
} from "./font/FontAtlasBlitter";
export type {
  CharacterPattern,
  FontEffect,
  FontEffectConfig,
  FontStyle,
  FontRenderingOptions,
  CharsetPreset,
  GlyphMetrics,
  FontDefinition,
} from "./font/FontTypes";
export { DefaultFont } from "./builtin/DefaultFont";
export { DefaultTexture } from "./builtin/DefaultTexture";

export { Texture2D } from "./image/Texture2D";
export type { TextureFilter, TextureAddressMode } from "./image/Texture2D";
export { Shader } from "./shader/Shader";
export { Song } from "./audio/Song";
export { SoundEffect } from "./audio/SoundEffect";
export { AudioLoader } from "./loaders/AudioLoader";
export * from "./loaders";
export type { LoadingProgress, AssetLoadProgress } from "./LoadingProgress";
