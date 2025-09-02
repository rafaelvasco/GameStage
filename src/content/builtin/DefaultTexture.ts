// DefaultTexture.ts - Default engine logo texture using unified Bitmap

import { Texture2D } from "../image/Texture2D";
import { Bitmap, Blitter } from "../../graphics";

/**
 * DefaultTexture class that generates a 512x512 demoscene-inspired Game Stage AI logo
 * Features a hexagonal portal with geometric curtain elements and pixel-perfect aesthetics
 */
export class DefaultTexture {
  private static instance: Texture2D | null = null;
  private static readonly TEXTURE_SIZE = 512;

  /**
   * Get the singleton default texture instance
   */
  static async getInstance(): Promise<Texture2D> {
    if (!DefaultTexture.instance) {
      DefaultTexture.instance = await DefaultTexture.createDefaultTexture();
    }
    return DefaultTexture.instance;
  }

  /**
   * Create the demoscene-inspired Game Stage AI logo using Blitter
   */
  private static async createDefaultTexture(): Promise<Texture2D> {
    const size = DefaultTexture.TEXTURE_SIZE;
    const bitmap = Bitmap.create(size, size);
    const blitter = Blitter.getInstance();
    blitter.setTarget(bitmap);

    // Deep space background with gradient
    DefaultTexture.drawSpaceBackground(blitter, size);

    // Pixel-perfect scan lines for retro feel
    DefaultTexture.drawScanLines(blitter, size);

    // Neon highlights and accents
    DefaultTexture.drawNeonAccents(blitter, size);

    // Create texture from the generated image data
    return await Texture2D.fromImageData(
      "game-stage-ai-logo",
      bitmap.imageData
    );
  }

  /**
   * Draw deep space background with vertical gradient
   */
  private static drawSpaceBackground(blitter: Blitter, size: number): void {
    for (let y = 0; y < size; y++) {
      const gradient = y / size;
      const r = Math.floor(8 + gradient * 16); // 8-24
      const g = Math.floor(16 + gradient * 32); // 16-48
      const b = Math.floor(48 + gradient * 80); // 48-128
      const color = Bitmap.rgba(r, g, b, 255);

      blitter.drawLine(0, y, size - 1, y, color);
    }
  }

  /**
   * Draw subtle scan lines for retro computing feel
   */
  private static drawScanLines(blitter: Blitter, size: number): void {
    const scanLineColor = Bitmap.rgba(0, 255, 0, 64); // Semi-transparent green

    for (let y = 0; y < size; y += 4) {
      blitter.drawLine(0, y, size - 1, y, scanLineColor);
    }
  }

  /**
   * Draw neon highlights and accent elements
   */
  private static drawNeonAccents(blitter: Blitter, size: number): void {
    const neonYellow = Bitmap.rgba(255, 255, 0, 255);

    // Draw corner accents
    const cornerSize = 32;

    // Top-left corner
    blitter.drawLine(8, 8, 8 + cornerSize, 8, neonYellow);
    blitter.drawLine(8, 8, 8, 8 + cornerSize, neonYellow);

    // Top-right corner
    blitter.drawLine(size - 8 - cornerSize, 8, size - 8, 8, neonYellow);
    blitter.drawLine(size - 8, 8, size - 8, 8 + cornerSize, neonYellow);

    // Bottom-left corner
    blitter.drawLine(8, size - 8 - cornerSize, 8, size - 8, neonYellow);
    blitter.drawLine(8, size - 8, 8 + cornerSize, size - 8, neonYellow);

    // Bottom-right corner
    blitter.drawLine(
      size - 8,
      size - 8 - cornerSize,
      size - 8,
      size - 8,
      neonYellow
    );
    blitter.drawLine(
      size - 8 - cornerSize,
      size - 8,
      size - 8,
      size - 8,
      neonYellow
    );
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    if (DefaultTexture.instance) {
      DefaultTexture.instance.dispose();
      DefaultTexture.instance = null;
    }
  }

  /**
   * Get texture dimensions
   */
  static getTextureDimensions(): { width: number; height: number } {
    return {
      width: DefaultTexture.TEXTURE_SIZE,
      height: DefaultTexture.TEXTURE_SIZE,
    };
  }
}
