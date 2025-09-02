// AssetBundle.ts - Asset bundle system interfaces and types

import type { LoadingProgress, AssetLoadProgress } from "./LoadingProgress";
import type { FontDefinition } from "./font/FontTypes";

export interface BaseAssetDefinition {
  id: string;
  type: "texture" | "song" | "soundeffect" | "shader" | "font";
}

export interface TextureAssetDefinition extends BaseAssetDefinition {
  type: "texture";
  path: string;
}

export interface ShaderAssetDefinition extends BaseAssetDefinition {
  type: "shader";
  path: string;
}

export interface FontAssetDefinition extends BaseAssetDefinition {
  type: "font";
  font: FontDefinition;
}

export interface SongAssetDefinition extends BaseAssetDefinition {
  type: "song";
  path: string;
  volume?: number;
  loop?: boolean;
}

export interface SoundEffectAssetDefinition extends BaseAssetDefinition {
  type: "soundeffect";
  path: string;
  volume?: number;
  poolSize?: number;
}

export type AssetDefinition =
  | TextureAssetDefinition
  | ShaderAssetDefinition
  | FontAssetDefinition
  | SongAssetDefinition
  | SoundEffectAssetDefinition;

export interface AssetBundle {
  name: string;
  assets: AssetDefinition[];
}

// Re-export for convenience
export type { LoadingProgress, AssetLoadProgress };
