// Blitter.ts - High-performance bitmap drawing operations
// Provides fast pixel manipulation by working directly with bitmap data32 arrays

import { Bitmap } from '../Bitmap';
import { Color32 } from '../Color32';
import { Font } from '../../content/font/Font';

/**
 * High-performance bitmap drawing operations class
 * Works directly with bitmap data32 arrays for maximum performance
 * Singleton pattern for optimal performance
 */
export class Blitter {
  private static instance: Blitter;
  
  private _target: Bitmap | null = null;
  private _targetData32: Uint32Array | null = null;
  private _targetWidth: number = 0;
  private _targetHeight: number = 0;

  private constructor() {}

  /**
   * Get the singleton Blitter instance
   */
  static getInstance(): Blitter {
    if (!Blitter.instance) {
      Blitter.instance = new Blitter();
    }
    return Blitter.instance;
  }

  /**
   * Set the target bitmap for drawing operations
   */
  setTarget(bitmap: Bitmap): void {
    this._target = bitmap;
    this._targetData32 = bitmap.data32;
    this._targetWidth = bitmap.width;
    this._targetHeight = bitmap.height;
  }

  /**
   * Get the current target bitmap
   */
  get target(): Bitmap | null {
    return this._target;
  }

  /**
   * Ensure target is set, throw error if not
   */
  private ensureTarget(): void {
    if (!this._target || !this._targetData32) {
      throw new Error('Blitter target not set. Call setTarget(bitmap) first.');
    }
  }

  // ===== FILLING OPERATIONS =====

  /**
   * Fill the entire bitmap with a color
   */
  fill(color: Color32): void {
    this.ensureTarget();
    const data32 = this._targetData32!;
    const len = data32.length;
    
    for (let i = 0; i < len; i++) {
      data32[i] = color;
    }
  }

  /**
   * Fill the entire bitmap with RGBA color components
   */
  fillRGBA(r: number, g: number, b: number, a: number = 255): void {
    const color = Bitmap.rgba(r, g, b, a);
    this.fill(color);
  }

  /**
   * Clear the bitmap (fill with transparent black)
   */
  clear(): void {
    this.fill(0);
  }

  /**
   * Fill a rectangular area with a color
   */
  fillRect(x: number, y: number, width: number, height: number, color: Color32): void {
    this.ensureTarget();
    const data32 = this._targetData32!;
    const targetWidth = this._targetWidth;
    const targetHeight = this._targetHeight;

    // Clip to bounds
    const x1 = Math.max(0, Math.min(targetWidth, x));
    const y1 = Math.max(0, Math.min(targetHeight, y));
    const x2 = Math.max(0, Math.min(targetWidth, x + width));
    const y2 = Math.max(0, Math.min(targetHeight, y + height));

    for (let py = y1; py < y2; py++) {
      const rowStart = py * targetWidth;
      for (let px = x1; px < x2; px++) {
        data32[rowStart + px] = color;
      }
    }
  }

  /**
   * Fill a rectangular area with RGBA color components
   */
  fillRectRGBA(x: number, y: number, width: number, height: number, r: number, g: number, b: number, a: number = 255): void {
    const color = Bitmap.rgba(r, g, b, a);
    this.fillRect(x, y, width, height, color);
  }

  /**
   * Fill a circle with a color
   */
  fillCircle(centerX: number, centerY: number, radius: number, color: Color32): void {
    this.ensureTarget();
    const data32 = this._targetData32!;
    const targetWidth = this._targetWidth;
    const targetHeight = this._targetHeight;
    
    const radiusSquared = radius * radius;
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(targetWidth - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(targetHeight - 1, Math.ceil(centerY + radius));

    for (let y = minY; y <= maxY; y++) {
      const dy = y - centerY;
      const rowStart = y * targetWidth;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerX;
        if (dx * dx + dy * dy <= radiusSquared) {
          data32[rowStart + x] = color;
        }
      }
    }
  }

  // ===== DRAWING OPERATIONS =====

  /**
   * Draw a line using Bresenham's algorithm
   */
  drawLine(x0: number, y0: number, x1: number, y1: number, color: Color32): void {
    this.ensureTarget();
    const data32 = this._targetData32!;
    const targetWidth = this._targetWidth;
    const targetHeight = this._targetHeight;

    x0 = Math.floor(x0);
    y0 = Math.floor(y0);
    x1 = Math.floor(x1);
    y1 = Math.floor(y1);

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    while (true) {
      // Draw pixel if within bounds
      if (x >= 0 && x < targetWidth && y >= 0 && y < targetHeight) {
        data32[y * targetWidth + x] = color;
      }

      if (x === x1 && y === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /**
   * Draw a line with RGBA color components
   */
  drawLineRGBA(x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, a: number = 255): void {
    const color = Bitmap.rgba(r, g, b, a);
    this.drawLine(x0, y0, x1, y1, color);
  }

  /**
   * Draw a circle outline
   */
  drawCircle(centerX: number, centerY: number, radius: number, color: Color32): void {
    this.ensureTarget();
    const data32 = this._targetData32!;
    const targetWidth = this._targetWidth;
    const targetHeight = this._targetHeight;

    // Midpoint circle algorithm
    let x = 0;
    let y = radius;
    let d = 1 - radius;

    const setPixelSafe = (px: number, py: number) => {
      if (px >= 0 && px < targetWidth && py >= 0 && py < targetHeight) {
        data32[py * targetWidth + px] = color;
      }
    };

    // Draw initial points
    setPixelSafe(centerX, centerY + radius);
    setPixelSafe(centerX, centerY - radius);
    setPixelSafe(centerX + radius, centerY);
    setPixelSafe(centerX - radius, centerY);

    while (x < y) {
      if (d < 0) {
        d += 2 * x + 3;
      } else {
        d += 2 * (x - y) + 5;
        y--;
      }
      x++;

      // Draw 8 symmetric points
      setPixelSafe(centerX + x, centerY + y);
      setPixelSafe(centerX - x, centerY + y);
      setPixelSafe(centerX + x, centerY - y);
      setPixelSafe(centerX - x, centerY - y);
      setPixelSafe(centerX + y, centerY + x);
      setPixelSafe(centerX - y, centerY + x);
      setPixelSafe(centerX + y, centerY - x);
      setPixelSafe(centerX - y, centerY - x);
    }
  }

  /**
   * Draw a rectangle outline
   */
  drawRect(x: number, y: number, width: number, height: number, color: Color32, lineWidth: number = 1): void {
    // Draw four sides of the rectangle
    for (let i = 0; i < lineWidth; i++) {
      // Top edge
      this.drawLine(x + i, y + i, x + width - 1 - i, y + i, color);
      // Bottom edge
      this.drawLine(x + i, y + height - 1 - i, x + width - 1 - i, y + height - 1 - i, color);
      // Left edge
      this.drawLine(x + i, y + i, x + i, y + height - 1 - i, color);
      // Right edge
      this.drawLine(x + width - 1 - i, y + i, x + width - 1 - i, y + height - 1 - i, color);
    }
  }

  // ===== BITMAP OPERATIONS =====

  /**
   * Draw another bitmap onto this bitmap
   */
  drawBitmap(source: Bitmap, x: number, y: number, width?: number, height?: number): void {
    this.ensureTarget();
    
    const targetData32 = this._targetData32!;
    const targetWidth = this._targetWidth;
    const targetHeight = this._targetHeight;
    
    const sourceData32 = source.data32;
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    
    const drawWidth = width || sourceWidth;
    const drawHeight = height || sourceHeight;

    if (width === undefined && height === undefined) {
      // Direct copy (fastest path)
      const minWidth = Math.min(sourceWidth, targetWidth - x);
      const minHeight = Math.min(sourceHeight, targetHeight - y);
      
      for (let py = 0; py < minHeight; py++) {
        const sourceRow = py * sourceWidth;
        const targetRow = (y + py) * targetWidth + x;
        
        for (let px = 0; px < minWidth; px++) {
          const sourcePixel = sourceData32[sourceRow + px];
          if ((sourcePixel >>> 24) > 0) { // Only draw non-transparent pixels
            targetData32[targetRow + px] = sourcePixel;
          }
        }
      }
    } else {
      // Scaled copy (slower but flexible)
      const scaleX = sourceWidth / drawWidth;
      const scaleY = sourceHeight / drawHeight;
      
      for (let py = 0; py < drawHeight; py++) {
        const sourceY = Math.floor(py * scaleY);
        if (y + py >= targetHeight) break;
        
        const targetRow = (y + py) * targetWidth;
        const sourceRow = sourceY * sourceWidth;
        
        for (let px = 0; px < drawWidth; px++) {
          if (x + px >= targetWidth) break;
          
          const sourceX = Math.floor(px * scaleX);
          const sourcePixel = sourceData32[sourceRow + sourceX];
          
          if ((sourcePixel >>> 24) > 0) { // Only draw non-transparent pixels
            targetData32[targetRow + (x + px)] = sourcePixel;
          }
        }
      }
    }
  }

  /**
   * Draw a region from a source bitmap onto this bitmap
   */
  drawBitmapRegion(
    source: Bitmap, 
    srcX: number, 
    srcY: number, 
    srcWidth: number, 
    srcHeight: number, 
    destX: number, 
    destY: number
  ): void {
    this.ensureTarget();
    
    const targetData32 = this._targetData32!;
    const targetWidth = this._targetWidth;
    const targetHeight = this._targetHeight;
    
    const sourceData32 = source.data32;
    const sourceWidth = source.width;
    
    // Clamp source region to source bitmap bounds
    const clampedSrcX = Math.max(0, Math.min(srcX, sourceWidth));
    const clampedSrcY = Math.max(0, Math.min(srcY, source.height));
    const clampedSrcWidth = Math.max(0, Math.min(srcWidth, sourceWidth - clampedSrcX));
    const clampedSrcHeight = Math.max(0, Math.min(srcHeight, source.height - clampedSrcY));
    
    // Clamp destination region to target bitmap bounds
    const clampedDestX = Math.max(0, destX);
    const clampedDestY = Math.max(0, destY);
    const maxDestWidth = Math.min(clampedSrcWidth, targetWidth - clampedDestX);
    const maxDestHeight = Math.min(clampedSrcHeight, targetHeight - clampedDestY);
    
    // Copy pixels from source region to destination
    for (let py = 0; py < maxDestHeight; py++) {
      const sourceRow = (clampedSrcY + py) * sourceWidth + clampedSrcX;
      const targetRow = (clampedDestY + py) * targetWidth + clampedDestX;
      
      for (let px = 0; px < maxDestWidth; px++) {
        const sourcePixel = sourceData32[sourceRow + px];
        if ((sourcePixel >>> 24) > 0) { // Only draw non-transparent pixels
          targetData32[targetRow + px] = sourcePixel;
        }
      }
    }
  }

  /**
   * Draw an HTMLImageElement or ImageBitmap onto this bitmap
   */
  drawImage(source: HTMLImageElement | ImageBitmap, x: number, y: number, width?: number, height?: number): void {
    this.ensureTarget();
    
    // Create temporary bitmap from image source
    const tempBitmap = source instanceof HTMLImageElement 
      ? Bitmap.fromImage(source)
      : Bitmap.fromImageBitmap(source);
    
    // Draw the temporary bitmap
    this.drawBitmap(tempBitmap, x, y, width, height);
  }

  // ===== TEXT DRAWING OPERATIONS =====

  /**
   * Draw text using a font (works with both pattern and file-based fonts)
   */
  drawText(text: string, x: number, y: number, font: Font): void {
    this.ensureTarget();
    
    if (!font.isLoaded) {
      return; // Font not loaded yet
    }
    
    let currentX = x;
    let currentY = y;
    
    // Get the font atlas bitmap
    const atlasBitmap = font.getBitmap();
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Handle newlines
      if (char === '\n') {
        currentX = x;
        currentY += font.lineHeight;
        continue;
      }
      
      // Get glyph information
      const glyph = font.getGlyph(char);
      if (!glyph) {
        // Skip unknown characters
        continue;
      }
      
      // Extract glyph from atlas and draw it
      this.drawBitmapRegion(
        atlasBitmap,
        glyph.region.x,
        glyph.region.y,
        glyph.region.width,
        glyph.region.height,
        currentX + glyph.bearingX,
        currentY - glyph.bearingY
      );
      
      // Advance cursor
      currentX += glyph.xAdvance;
      
      // Apply kerning if there's a next character
      if (i < text.length - 1) {
        const nextChar = text[i + 1];
        currentX += font.getKerning(char, nextChar);
      }
    }
  }

  /**
   * Draw text centered horizontally
   */
  drawTextCentered(text: string, y: number, font: Font): void {
    this.ensureTarget();
    
    const textWidth = font.measureText(text);
    const centerX = (this._targetWidth - textWidth) / 2;
    
    this.drawText(text, Math.floor(centerX), y, font);
  }

  /**
   * Draw text centered both horizontally and vertically
   */
  drawTextCenteredBoth(text: string, font: Font): void {
    this.ensureTarget();
    
    const textSize = font.measureTextSize(text);
    const centerX = (this._targetWidth - textSize.width) / 2;
    const centerY = (this._targetHeight - textSize.height) / 2;
    
    this.drawText(text, Math.floor(centerX), Math.floor(centerY), font);
  }

  /**
   * Draw multiline text with line spacing
   */
  drawTextMultiline(text: string, x: number, y: number, font: Font, lineSpacing: number = 2): void {
    this.ensureTarget();
    
    const lines = text.split('\n');
    let currentY = y;
    
    for (const line of lines) {
      this.drawText(line, x, currentY, font);
      currentY += font.lineHeight + lineSpacing;
    }
  }

  /**
   * Draw text within a rectangular bounds with word wrapping
   */
  drawTextWrapped(text: string, x: number, y: number, maxWidth: number, font: Font, lineSpacing: number = 2): void {
    this.ensureTarget();
    
    const words = text.split(' ');
    let currentLine = '';
    let currentY = y;
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const testWidth = font.measureText(testLine);
      
      if (testWidth > maxWidth && currentLine) {
        // Draw current line and start new one
        this.drawText(currentLine, x, currentY, font);
        currentY += font.lineHeight + lineSpacing;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    // Draw remaining text
    if (currentLine) {
      this.drawText(currentLine, x, currentY, font);
    }
  }
}