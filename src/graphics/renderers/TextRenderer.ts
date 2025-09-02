// TextRenderer.ts - Handles all text rendering operations

import { BaseRenderer } from "./IRenderer";
import { Color } from "../Color";
import { Font } from "../../content/font/Font";
import { TextRenderingUtils } from "../TextRenderingUtils";
import { QuadRenderer } from "./QuadRenderer";
import { Texture2D } from "../../content/image/Texture2D";

/**
 * Specialized renderer for text operations.
 *
 * Handles:
 * - Basic text drawing with kerning
 * - Extended text drawing with alignment and scaling
 * - Text area rendering with word wrapping
 * - Text measurement and sizing
 * - Justified text layout
 */
export class TextRenderer extends BaseRenderer {
  private textUtils!: TextRenderingUtils;
  private quadRenderer!: QuadRenderer;

  // Pre-allocated arrays to reduce memory allocations
  private readonly tempLines: string[] = [];
  private readonly tempWords: string[] = [];
  private readonly tempWordWidths: number[] = [];
  private readonly tempGraphemes: string[] = [];

  /**
   * Initialize with dependencies
   */
  initializeWithDependencies(
    textUtils: TextRenderingUtils,
    quadRenderer: QuadRenderer
  ): void {
    this.textUtils = textUtils;
    this.quadRenderer = quadRenderer;
  }

  /**
   * Draw text using a font with kerning support
   * @param font - The font to use for rendering
   * @param text - The text to draw
   * @param x - X position (left edge of text)
   * @param y - Y position (top of text, top-left pivot)
   * @param color - Text color (default: white)
   */
  drawText(
    font: Font,
    text: string,
    x: number,
    y: number,
    color: Color = Color.WHITE
  ): void {
    this.ensureInitialized();

    if (!font) {
      this.logger.error("TextRenderer drawText: font cannot be null");
      return;
    }

    if (!text) {
      // Empty text is valid - just return early
      return;
    }

    if (!font.isLoaded) {
      this.logger.warn("Font not loaded, skipping text rendering");
      return;
    }

    // Get the texture - if it's null, the texture is still being created
    const atlas = font.texture;
    if (!atlas) {
      // Texture is still being created asynchronously, skip this frame
      return;
    }

    this.splitLinesInto(text, this.tempLines);
    let currentY = y;

    for (let i = 0; i < this.tempLines.length; i++) {
      this.drawTextLine(font, this.tempLines[i], x, currentY, color, atlas);
      currentY += font.lineHeight;
    }
  }

  /**
   * Draw text with alignment and scaling options
   * @param font - The font to use for rendering
   * @param text - The text to draw
   * @param x - X position
   * @param y - Y position
   * @param color - Text color (default: white)
   * @param align - Text alignment ('left', 'center', 'right')
   */
  drawTextEx(
    font: Font,
    text: string,
    x: number,
    y: number,
    color: Color = Color.WHITE,
    align: "left" | "center" | "right" = "left"
  ): void {
    this.ensureInitialized();

    if (!font.isLoaded) {
      this.logger.warn("Font not loaded, skipping text rendering");
      return;
    }

    // Get the texture - if it's null, the texture is still being created
    const atlas = font.texture;
    if (!atlas) {
      // Texture is still being created asynchronously, skip this frame
      return;
    }

    this.splitLinesInto(text, this.tempLines);
    let currentY = y;

    for (let i = 0; i < this.tempLines.length; i++) {
      const line = this.tempLines[i];
      let currentX = x;

      if (align === "center" || align === "right") {
        const lineWidth = this.textUtils.measureTextCached(font, line);
        if (align === "center") {
          currentX -= lineWidth / 2;
        } else {
          currentX -= lineWidth;
        }
      }

      this.drawTextLine(font, line, currentX, currentY, color, atlas);
      currentY += font.lineHeight;
    }
  }

  /**
   * Draw a single line of text with kerning
   * @param font - The font to use for rendering
   * @param text - The text line to draw (should not contain newlines)
   * @param x - X position (left edge of text)
   * @param y - Y position (top of text, top-left pivot)
   * @param color - Text color
   * @param atlas - The font atlas texture
   */
  private drawTextLine(
    font: Font,
    text: string,
    x: number,
    y: number,
    color: Color,
    atlas: Texture2D
  ): void {
    this.textUtils.splitGraphemesInto(text, this.tempGraphemes);
    let currentX = x;

    // Cache maxBearingY calculation outside the loop
    const actualMaxBearingY = this.textUtils.getMaxBearingY(font);

    for (let i = 0; i < this.tempGraphemes.length; i++) {
      const char = this.tempGraphemes[i];

      const glyph = font.getGlyph(char);
      if (!glyph) {
        continue;
      }

      if (char !== " ") {
        // Round all coordinates to integers for pixel-perfect rendering
        const glyphX = Math.round(currentX + glyph.bearingX);
        const glyphY = Math.round(y + (actualMaxBearingY - glyph.bearingY));

        this.quadRenderer.drawQuadEx(
          atlas,
          glyphX,
          glyphY,
          color,
          glyph.width,
          glyph.height,
          0,
          0,
          glyph.region
        );
      }

      currentX += glyph.xAdvance;

      if (i < this.tempGraphemes.length - 1) {
        const nextChar = this.tempGraphemes[i + 1];
        const kerningAdjustment = font.getKerning(char, nextChar);
        currentX += kerningAdjustment;
      }
    }
  }

  /**
   * Measure text size with kerning
   * @param font - The font to use for measurement
   * @param text - The text to measure
   * @returns Object with width and height in pixels
   */
  measureText(font: Font, text: string): { width: number; height: number } {
    const size = font.measureTextSize(text);
    return {
      width: size.width,
      height: size.height,
    };
  }

  /**
   * Draw text within a rectangular area with word wrapping and alignment
   *
   * This method automatically wraps text to fit within the specified area and supports
   * various alignment options. It handles word boundaries intelligently and can break
   * very long words if necessary.
   *
   * @example
   * ```typescript
   * // Basic usage with left alignment
   * canvas.drawTextArea(
   *   font,
   *   "This text will be wrapped to fit within the area.",
   *   100, 100, 200, 150,
   *   Color.WHITE
   * );
   *
   * // Center aligned with padding
   * canvas.drawTextArea(
   *   font,
   *   "Centered text with padding around the edges.",
   *   50, 50, 300, 200,
   *   Color.BLUE,
   *   { align: "center", padding: 20, verticalAlign: "center" }
   * );
   *
   * // Justified text with custom line spacing
   * const result = canvas.drawTextArea(
   *   font,
   *   "This text will be justified and have custom line spacing.",
   *   0, 0, 400, 100,
   *   Color.BLACK,
   *   { align: "justify", lineSpacing: 1.5, clipToArea: true }
   * );
   *
   * console.log(`Wrapped into ${result.lines.length} lines`);
   * console.log(`Total height: ${result.totalHeight}px`);
   * console.log(`Text was clipped: ${result.clipped}`);
   * ```
   *
   * @param font - The font to use for rendering
   * @param text - The text to draw (supports \n for explicit line breaks)
   * @param x - X position of the text area (top-left corner)
   * @param y - Y position of the text area (top-left corner)
   * @param width - Width of the text area
   * @param height - Height of the text area
   * @param color - Text color (default: white)
   * @param options - Text area rendering options
   * @param options.align - Horizontal alignment: "left", "center", "right", or "justify" (default: "left")
   * @param options.verticalAlign - Vertical alignment: "top", "center", or "bottom" (default: "top")
   * @param options.lineSpacing - Line spacing multiplier (default: 1.0)
   * @param options.padding - Internal padding in pixels (default: 0)
   * @param options.clipToArea - Whether to clip text that exceeds the area height (default: true)
   * @param pushTransform - Function to push current transform state
   * @param popTransform - Function to pop transform state
   * @returns Object containing the wrapped lines, total height, and whether text was clipped
   */
  drawTextArea(
    font: Font,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color = Color.WHITE,
    options: {
      align?: "left" | "center" | "right" | "justify";
      verticalAlign?: "top" | "center" | "bottom";
      lineSpacing?: number;
      padding?: number;
      clipToArea?: boolean;
    } = {},
    pushTransform?: () => void,
    popTransform?: () => void
  ): {
    lines: string[];
    totalHeight: number;
    clipped: boolean;
  } {
    this.ensureInitialized();

    if (!font.isLoaded) {
      this.logger.warn("Font not loaded, skipping text area rendering");
      return { lines: [], totalHeight: 0, clipped: false };
    }

    // Get the texture - if it's null, the texture is still being created
    const atlas = font.texture;
    if (!atlas) {
      // Texture is still being created asynchronously, skip this frame
      return { lines: [], totalHeight: 0, clipped: false };
    }

    // Default options
    const {
      align = "left",
      verticalAlign = "top",
      lineSpacing = 1.0,
      padding = 0,
      clipToArea = true,
    } = options;

    // Calculate available area after padding
    const availableWidth = Math.max(0, width - padding * 2);
    const availableHeight = Math.max(0, height - padding * 2);
    const textX = x + padding;
    const textY = y + padding;

    if (availableWidth <= 0 || availableHeight <= 0) {
      return { lines: [], totalHeight: 0, clipped: false };
    }

    // Wrap text to fit within available width
    const wrappedLines = this.textUtils.wrapText(font, text, availableWidth);

    // Calculate line height and total text height
    const lineHeight = font.lineHeight * lineSpacing;
    const totalTextHeight = wrappedLines.length * lineHeight;

    // Determine if text will be clipped
    const clipped = totalTextHeight > availableHeight;

    // Calculate visible lines if clipping is enabled
    let visibleLines = wrappedLines;
    if (clipToArea && clipped) {
      const maxVisibleLines = Math.floor(availableHeight / lineHeight);
      visibleLines = wrappedLines.slice(0, maxVisibleLines);
    }

    // Calculate vertical starting position based on alignment
    // For top alignment, use the original Y coordinate to match drawText behavior
    let startY = verticalAlign === "top" ? y + padding : textY;
    if (verticalAlign === "center") {
      const visibleHeight = Math.min(totalTextHeight, availableHeight);
      startY = textY + (availableHeight - visibleHeight) / 2;
    } else if (verticalAlign === "bottom") {
      const visibleHeight = Math.min(totalTextHeight, availableHeight);
      startY = textY + availableHeight - visibleHeight;
    }

    // Save current transform state for clipping
    if (clipToArea && pushTransform) {
      pushTransform();
      // Note: Actual clipping implementation would depend on the graphics backend
      // For now, we rely on the line culling above
    }

    // Pre-compute line widths for alignment if needed
    this.tempWordWidths.length = visibleLines.length;
    if (align === "center" || align === "right") {
      for (let i = 0; i < visibleLines.length; i++) {
        this.tempWordWidths[i] = this.textUtils.measureTextCached(font, visibleLines[i]);
      }
    }

    // Render each visible line
    for (let i = 0; i < visibleLines.length; i++) {
      const line = visibleLines[i];
      const lineY = startY + i * lineHeight;

      // Skip lines that are outside the visible area
      if (
        clipToArea &&
        (lineY < textY || lineY + lineHeight > textY + availableHeight)
      ) {
        continue;
      }

      let lineX = textX;

      // Calculate horizontal alignment using pre-computed widths
      if (align === "center") {
        lineX = textX + (availableWidth - this.tempWordWidths[i]) / 2;
      } else if (align === "right") {
        lineX = textX + availableWidth - this.tempWordWidths[i];
      } else if (align === "justify" && i < visibleLines.length - 1) {
        // Justify text (except for the last line)
        this.drawJustifiedTextLine(
          font,
          line,
          textX,
          lineY,
          availableWidth,
          color,
          atlas
        );
        continue;
      }

      // Draw the line
      this.drawTextLine(font, line, lineX, lineY, color, atlas);
    }

    // Restore transform state if clipping was used
    if (clipToArea && popTransform) {
      popTransform();
    }

    return {
      lines: wrappedLines,
      totalHeight: totalTextHeight,
      clipped: clipped,
    };
  }

  /**
   * Draw a justified line of text (internal helper)
   * @param font - The font to use for rendering
   * @param text - The text line to draw
   * @param x - X position (left edge)
   * @param y - Y position (top edge)
   * @param width - Width to justify within
   * @param color - Text color
   * @param atlas - The font atlas texture
   */
  private drawJustifiedTextLine(
    font: Font,
    text: string,
    x: number,
    y: number,
    width: number,
    color: Color,
    atlas: Texture2D
  ): void {
    this.splitWordsInto(text.trim(), this.tempWords);

    // Don't justify single words or empty lines
    if (this.tempWords.length <= 1) {
      this.drawTextLine(font, text, x, y, color, atlas);
      return;
    }

    // Calculate total word width and required spacing
    let totalWordWidth = 0;
    this.tempWordWidths.length = this.tempWords.length;
    for (let i = 0; i < this.tempWords.length; i++) {
      const word = this.tempWords[i];
      const wordWidth = this.textUtils.measureTextCached(font, word);
      this.tempWordWidths[i] = wordWidth;
      totalWordWidth += wordWidth;
    }

    const totalSpaceWidth = width - totalWordWidth;
    const spacesBetweenWords = this.tempWords.length - 1;
    const spaceWidth = totalSpaceWidth / spacesBetweenWords;

    // Draw each word with calculated spacing
    let currentX = x;
    for (let i = 0; i < this.tempWords.length; i++) {
      const word = this.tempWords[i];
      this.drawTextLine(font, word, currentX, y, color, atlas);

      currentX += this.tempWordWidths[i];

      // Add justified space (except after the last word)
      if (i < this.tempWords.length - 1) {
        currentX += spaceWidth;
      }
    }
  }

  /**
   * Split text into lines, reusing a provided array to avoid allocations
   * @param text - Text to split
   * @param target - Target array to populate (will be cleared)
   */
  private splitLinesInto(text: string, target: string[]): void {
    target.length = 0;
    
    let start = 0;
    let pos = text.indexOf('\n');
    
    if (pos === -1) {
      target.push(text);
      return;
    }
    
    while (pos !== -1) {
      target.push(text.substring(start, pos));
      start = pos + 1;
      pos = text.indexOf('\n', start);
    }
    
    if (start < text.length) {
      target.push(text.substring(start));
    }
  }

  /**
   * Split text into words, reusing a provided array to avoid allocations
   * @param text - Text to split
   * @param target - Target array to populate (will be cleared)
   */
  private splitWordsInto(text: string, target: string[]): void {
    target.length = 0;
    
    let start = 0;
    let pos = text.indexOf(' ');
    
    if (pos === -1) {
      if (text.length > 0) {
        target.push(text);
      }
      return;
    }
    
    while (pos !== -1) {
      if (pos > start) {
        target.push(text.substring(start, pos));
      }
      start = pos + 1;
      pos = text.indexOf(' ', start);
    }
    
    if (start < text.length) {
      target.push(text.substring(start));
    }
  }
}
