// ColorUtils.ts - Utility functions for color operations

export class ColorUtils {
  /**
   * Pack RGBA components (0-1 range) into a single integer
   */
  static packRGBA(r: number, g: number, b: number, a: number): number {
    const rInt = Math.round(Math.max(0, Math.min(1, r)) * 255);
    const gInt = Math.round(Math.max(0, Math.min(1, g)) * 255);
    const bInt = Math.round(Math.max(0, Math.min(1, b)) * 255);
    const aInt = Math.round(Math.max(0, Math.min(1, a)) * 255);

    // Pack as RGBA where R is in bits 0-7 (to match shader unpacking)
    // Use >>> 0 to ensure unsigned 32-bit integer
    return (rInt | (gInt << 8) | (bInt << 16) | (aInt << 24)) >>> 0;
  }
}
