// QuadRenderer.ts - Handles all textured quad rendering operations

import { BaseRenderer } from "./IRenderer";
import { Color } from "../Color";
import { Texture2D } from "../../content/image/Texture2D";
import { TextureRegion } from "../TextureRegion";
import { Matrix } from "../../utils";

/**
 * Specialized renderer for textured quad operations.
 * 
 * Handles:
 * - Basic quad drawing with position
 * - Extended quad drawing with scaling, rotation, pivots
 * - Texture region rendering
 * - Transform operations and matrix calculations
 * - UV coordinate calculations
 */
export class QuadRenderer extends BaseRenderer {
  // Performance optimization: cache frequently used values
  private lastColorValue: number = 0xffffffff;
  private colorNeedsUpdate: boolean = true;

  /**
   * Draw a quad with basic parameters (position only)
   * @param texture - The texture to draw
   * @param x - X position in pixels
   * @param y - Y position in pixels
   * @param color - Optional color tint (default: white)
   */
  drawQuad(texture: Texture2D, x: number, y: number, color?: Color): void {
    this.ensureInitialized();

    if (!texture) {
      this.logger.error("QuadRenderer drawQuad: texture cannot be null");
      return;
    }

    this.drawQuadInternal(
      texture,
      x,
      y,
      texture.width,
      texture.height,
      0,
      0,
      undefined,
      color,
      0,
      1.0,
      1.0
    );
  }

  /**
   * Draw a quad with extended parameters
   * @param texture - The texture to draw
   * @param x - X position
   * @param y - Y position
   * @param color - Optional color tint (default: white)
   * @param width - Optional width override (default: texture width)
   * @param height - Optional height override (default: texture height)
   * @param pivotX - Pivot point X as percentage (0.0 = left, 0.5 = center, 1.0 = right)
   * @param pivotY - Pivot point Y as percentage (0.0 = top, 0.5 = center, 1.0 = bottom)
   * @param region - Optional texture region to draw from
   * @param rotation - Optional rotation in radians around the quad center
   * @param scaleX - Optional horizontal scale factor (default: 1.0)
   * @param scaleY - Optional vertical scale factor (default: 1.0)
   */
  drawQuadEx(
    texture: Texture2D,
    x: number,
    y: number,
    color?: Color,
    width?: number,
    height?: number,
    pivotX?: number,
    pivotY?: number,
    region?: TextureRegion,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    this.ensureInitialized();

    if (!texture) {
      this.logger.error("QuadRenderer drawQuadEx: texture cannot be null");
      return;
    }

    // Use provided dimensions or texture dimensions
    const finalWidth = width ?? texture.width;
    const finalHeight = height ?? texture.height;
    const finalPivotX = pivotX ?? 0;
    const finalPivotY = pivotY ?? 0;
    const finalRotation = rotation ?? 0;
    const finalScaleX = scaleX ?? 1.0;
    const finalScaleY = scaleY ?? 1.0;

    // Calculate UV region if specified
    const uvRegion = region
      ? this.calculateUVRegion(texture, region)
      : undefined;

    this.drawQuadInternal(
      texture,
      x,
      y,
      finalWidth,
      finalHeight,
      finalPivotX,
      finalPivotY,
      uvRegion,
      color,
      finalRotation,
      finalScaleX,
      finalScaleY
    );
  }

  /**
   * Internal quad drawing method that applies transforms, pivot, and rotation
   * @param texture - The texture to draw
   * @param x - X position in pixels
   * @param y - Y position in pixels
   * @param width - Width of the quad in pixels
   * @param height - Height of the quad in pixels
   * @param pivotX - Pivot point X as percentage (0.0 = left, 0.5 = center, 1.0 = right)
   * @param pivotY - Pivot point Y as percentage (0.0 = top, 0.5 = center, 1.0 = bottom)
   * @param uvRegion - Optional UV coordinates for texture region
   * @param color - Optional color tint
   * @param rotation - Optional rotation in radians around quad center
   * @param scaleX - Optional horizontal scale factor (default: 1.0)
   * @param scaleY - Optional vertical scale factor (default: 1.0)
   */
  drawQuadInternal(
    texture: Texture2D,
    x: number,
    y: number,
    width: number,
    height: number,
    pivotX: number,
    pivotY: number,
    uvRegion?: Float32Array,
    color?: Color,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    const cachedArrays = this.getCachedArrays();

    // Apply scale to dimensions
    const finalScaleX = scaleX ?? 1.0;
    const finalScaleY = scaleY ?? 1.0;
    const scaledWidth = width * finalScaleX;
    const scaledHeight = height * finalScaleY;

    // Calculate quad corners in local space (before transform)
    // Optimize for common case of no pivot (0,0)
    let left, top, right, bottom;
    if (pivotX === 0 && pivotY === 0) {
      left = x;
      top = y;
      right = x + scaledWidth;
      bottom = y + scaledHeight;
    } else {
      // Calculate pivot offset only when needed
      const pivotOffsetX = -scaledWidth * pivotX;
      const pivotOffsetY = -scaledHeight * pivotY;
      left = x + pivotOffsetX;
      top = y + pivotOffsetY;
      right = left + scaledWidth;
      bottom = top + scaledHeight;
    }

    const corners = cachedArrays.corners;

    // Fill cached corners array (clockwise from top-left)
    corners[0] = left;
    corners[1] = top; // A: Top-left
    corners[2] = right;
    corners[3] = top; // B: Top-right
    corners[4] = right;
    corners[5] = bottom; // C: Bottom-right
    corners[6] = left;
    corners[7] = bottom; // D: Bottom-left

    // Apply local rotation if specified (around sprite center)
    if (rotation && rotation !== 0) {
      this.rotateCorners(corners, x, y, rotation);
    }

    // Transform each corner by the current transform matrix (keep in screen space)
    const currentTransform = this.getCurrentTransform();
    for (let i = 0; i < 4; i++) {
      const cornerIndex = i * 2;
      const cornerX = corners[cornerIndex];
      const cornerY = corners[cornerIndex + 1];

      // Apply current transform matrix using Matrix utility
      const transformed = Matrix.transformPoint(currentTransform, cornerX, cornerY);

      cachedArrays.transformedCorners[cornerIndex] = transformed.x;
      cachedArrays.transformedCorners[cornerIndex + 1] = transformed.y;
    }

    // Use provided UV region or default to full texture
    const finalUVRegion = uvRegion || cachedArrays.uvRegion;

    // Use provided color or default to cached white colors
    let finalVertexColors: Uint32Array;
    if (color) {
      const colorValue = color.rgba;
      // Only update vertex colors if the color has changed
      if (this.lastColorValue !== colorValue || this.colorNeedsUpdate) {
        cachedArrays.vertexColors.fill(colorValue);
        this.lastColorValue = colorValue;
        this.colorNeedsUpdate = false;
      }
      finalVertexColors = cachedArrays.vertexColors;
    } else {
      finalVertexColors = cachedArrays.cachedVertexColors;
    }

    // Pass transformed corners to drawQuad using cached arrays
    this.graphics.drawQuad(
      texture.texture,
      texture.sampler,
      cachedArrays.transformedCorners, // vertices array
      finalUVRegion, // UV coordinates
      finalVertexColors // vertex colors
    );
  }

  /**
   * Calculate UV coordinates for a sprite region within a texture
   * @param texture - The source texture
   * @param region - The region definition with pixel coordinates
   * @returns Float32Array containing normalized UV coordinates [u1, v1, u2, v2]
   */
  private calculateUVRegion(
    texture: Texture2D,
    region: TextureRegion
  ): Float32Array {
    const textureWidth = texture.width;
    const textureHeight = texture.height;

    if (textureWidth <= 0 || textureHeight <= 0) {
      this.logger.error(
        `QuadRenderer calculateUVRegion: Invalid texture dimensions ${textureWidth}x${textureHeight}`
      );
      // Return default UV region for full texture
      const cachedArrays = this.getCachedArrays();
      return cachedArrays.uvRegion;
    }

    const cachedArrays = this.getCachedArrays();

    // Calculate UV coordinates with half-pixel inset to prevent bleeding
    const u1 = region.x / textureWidth;
    const v1 = region.y / textureHeight;
    const u2 = (region.x + region.width) / textureWidth;
    const v2 = (region.y + region.height) / textureHeight;

    // Clamp UV coordinates to valid range [0.0, 1.0] and store in cached array
    cachedArrays.calculatedUVRegion[0] = Math.max(0.0, Math.min(1.0, u1));
    cachedArrays.calculatedUVRegion[1] = Math.max(0.0, Math.min(1.0, v1));
    cachedArrays.calculatedUVRegion[2] = Math.max(0.0, Math.min(1.0, u2));
    cachedArrays.calculatedUVRegion[3] = Math.max(0.0, Math.min(1.0, v2));

    return cachedArrays.calculatedUVRegion;
  }

  /**
   * Rotate corners around a center point (in-place, no allocation)
   * @param corners - Array of corner coordinates [x1, y1, x2, y2, x3, y3, x4, y4]
   * @param centerX - X coordinate of rotation center
   * @param centerY - Y coordinate of rotation center
   * @param angle - Rotation angle in radians
   */
  private rotateCorners(
    corners: Float32Array,
    centerX: number,
    centerY: number,
    angle: number
  ): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (let i = 0; i < 4; i++) {
      const cornerIndex = i * 2;
      const x = corners[cornerIndex];
      const y = corners[cornerIndex + 1];

      // Translate to origin (relative to center)
      const relativeX = x - centerX;
      const relativeY = y - centerY;

      // Apply rotation
      const rotatedX = relativeX * cos - relativeY * sin;
      const rotatedY = relativeX * sin + relativeY * cos;

      // Translate back to original position
      corners[cornerIndex] = rotatedX + centerX;
      corners[cornerIndex + 1] = rotatedY + centerY;
    }
  }

  /**
   * Reset color cache when color management state changes
   */
  resetColorCache(): void {
    this.colorNeedsUpdate = true;
  }
}