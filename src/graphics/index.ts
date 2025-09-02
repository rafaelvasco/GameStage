// graphics/index.ts - Graphics module exports

export { Canvas } from "./Canvas";
export { Color } from "./Color";
export { ColorUtils } from "./ColorUtils";
export type { Color32 } from "./Color32";
export { Color32Utils } from "./Color32";
export { Graphics } from "./Graphics";
export { WebGL2Graphics } from "./webgl2/WebGL2Graphics";
export { WebGPUGraphics } from "./webgpu/WebGPUGraphics";
export { WebGL2Texture2D } from "./webgl2/WebGL2Texture2D";
export { WebGPUTexture2D } from "./webgpu/WebGPUTexture2D";
export { WebGL2Shader } from "./webgl2/WebGL2Shader";
export { WebGPUShader } from "./webgpu/WebGPUShader";
export { Bitmap } from "./Bitmap";
export { BlendMode } from "./Bitmap";
export { Blitter } from "./swgfx/Blitter";
export { SYSTEM_FONT_PATTERNS } from "./swgfx/fonts/SystemFont";
export { PIXEL_FONT_PATTERNS } from "./swgfx/fonts/PixelFont";

export type { IGraphicsContext, RenderingStats } from "./IGraphicsContext";
export type { ITexture2D } from "./ITexture2D";
export type { IShader } from "./IShader";
export { GraphicsBackendType } from "./Graphics";
export type { ActualBackendType } from "./Graphics";
export type { TextureRegion } from "./TextureRegion";
