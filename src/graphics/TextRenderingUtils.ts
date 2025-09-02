// TextRenderingUtils.ts - Utilities for text measurement, wrapping, and Unicode processing

import { Font } from "../content/font/Font";
import "../utils/TypeExtensions";

/**
 * Utility class for text rendering operations including measurement, wrapping, and Unicode processing.
 *
 * This class handles text-specific algorithms that don't require direct Canvas operations:
 * - Text measurement with caching
 * - Word wrapping algorithms
 * - Unicode grapheme segmentation
 * - Font metric calculations
 *
 * Uses singleton pattern for consistent caching across the application.
 */
export class TextRenderingUtils {
  private static instance: TextRenderingUtils;

  // Caches for performance optimization
  private textMeasureCache: Map<string, number> = new Map();
  private maxBearingYCache: Map<Font, number> = new Map();
  private graphemeCache: Map<string, string[]> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): TextRenderingUtils {
    if (!TextRenderingUtils.instance) {
      TextRenderingUtils.instance = new TextRenderingUtils();
    }
    return TextRenderingUtils.instance;
  }

  /**
   * Split text into grapheme clusters with caching
   * @param text - Text to split into graphemes
   * @returns Array of grapheme clusters
   */
  splitGraphemes(text: string): string[] {
    let graphemes = this.graphemeCache.get(text);
    if (graphemes) {
      return graphemes;
    }

    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter("en", {
        granularity: "grapheme",
      });
      graphemes = Array.from(
        segmenter.segment(text),
        (segment) => segment.segment
      );
    } else {
      graphemes = Array.from(text);
    }

    // Cache the result with size limit
    if (this.graphemeCache.size > 500) {
      const keysToDelete = Array.from(this.graphemeCache.keys()).slice(0, 100);
      keysToDelete.forEach((key) => this.graphemeCache.delete(key));
    }
    this.graphemeCache.set(text, graphemes);

    return graphemes;
  }

  /**
   * Split text into grapheme clusters, populating a target array to avoid allocations
   * @param text - Text to split into graphemes
   * @param target - Target array to populate (will be cleared)
   */
  splitGraphemesInto(text: string, target: string[]): void {
    let graphemes = this.graphemeCache.get(text);
    if (graphemes) {
      target.length = 0;
      for (let i = 0; i < graphemes.length; i++) {
        target[i] = graphemes[i];
      }
      target.length = graphemes.length;
      return;
    }

    target.length = 0;
    
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter("en", {
        granularity: "grapheme",
      });
      for (const segment of segmenter.segment(text)) {
        target.push(segment.segment);
      }
    } else {
      for (let i = 0; i < text.length; i++) {
        target.push(text[i]);
      }
    }

    // Cache the result with size limit (create copy for cache)
    if (this.graphemeCache.size > 500) {
      const keysToDelete = Array.from(this.graphemeCache.keys()).slice(0, 100);
      keysToDelete.forEach((key) => this.graphemeCache.delete(key));
    }
    this.graphemeCache.set(text, target.slice());
  }

  /**
   * Get maximum bearingY from font glyphs with caching
   * @param font - Font to calculate max bearingY for
   * @returns Maximum bearingY value
   */
  getMaxBearingY(font: Font): number {
    let maxBearingY = this.maxBearingYCache.get(font);
    if (maxBearingY !== undefined) {
      return maxBearingY;
    }

    if (!font.charset) {
      maxBearingY = font.ascent;
    } else {
      maxBearingY = 0;
      for (let i = 0; i < font.charset.length; i++) {
        const char = font.charset[i];
        const glyph = font.getGlyph(char);
        if (glyph) {
          maxBearingY = Math.max(maxBearingY, glyph.bearingY);
        }
      }
      maxBearingY = maxBearingY > 0 ? maxBearingY : font.ascent;
    }

    this.maxBearingYCache.set(font, maxBearingY);
    return maxBearingY;
  }

  /**
   * Cached text measurement for performance optimization
   * @param font - The font to use for measurement
   * @param text - The text to measure
   * @returns Text width in pixels
   */
  measureTextCached(font: Font, text: string): number {
    const cacheKey = `${font.id}_${text}`;

    let width = this.textMeasureCache.get(cacheKey);
    if (width === undefined) {
      width = font.measureText(text);
      this.textMeasureCache.set(cacheKey, width);

      // Prevent cache from growing too large
      if (this.textMeasureCache.size > 1000) {
        const keysToDelete = Array.from(this.textMeasureCache.keys()).slice(
          0,
          200
        );
        keysToDelete.forEach((key) => this.textMeasureCache.delete(key));
      }
    }

    return width;
  }

  /**
   * Binary search to find optimal break point for long words
   * @param font - The font to use for measurement
   * @param word - The word to break
   * @param maxWidth - Maximum width allowed
   * @returns Index where the word should be broken
   */
  findWordBreakPoint(font: Font, word: string, maxWidth: number): number {
    if (word.length <= 1) return 1;

    let left = 1;
    let right = word.length;
    let bestBreak = 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const substring = word.substring(0, mid);
      const width = this.measureTextCached(font, substring);

      if (width <= maxWidth) {
        bestBreak = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return bestBreak;
  }

  // Pre-allocated arrays for word wrapping to avoid allocations
  private readonly tempParagraphs: string[] = [];
  private readonly tempWords: string[] = [];
  private tempCurrentLine = "";
  private tempTestLine = "";

  /**
   * Word wrap text to fit within a specified width
   * @param font - The font to use for measurement
   * @param text - The text to wrap
   * @param maxWidth - Maximum width for each line
   * @returns Array of wrapped lines
   */
  wrapText(font: Font, text: string, maxWidth: number): string[] {
    if (!font.isLoaded) {
      return [text];
    }

    // Handle explicit line breaks first
    this.splitLinesInto(text, this.tempParagraphs);
    const wrappedLines: string[] = [];

    for (let p = 0; p < this.tempParagraphs.length; p++) {
      const paragraph = this.tempParagraphs[p];
      
      if (paragraph.trim() === "") {
        // Empty line
        wrappedLines.push("");
        continue;
      }

      // Check if the entire paragraph fits on one line
      const paragraphWidth = this.measureTextCached(font, paragraph);
      if (paragraphWidth <= maxWidth) {
        wrappedLines.push(paragraph);
        continue;
      }

      // Split paragraph into words for wrapping
      this.splitWordsInto(paragraph, this.tempWords);
      this.tempCurrentLine = "";

      for (let i = 0; i < this.tempWords.length; i++) {
        const word = this.tempWords[i];

        // Handle very long words that exceed maxWidth
        if (this.measureTextCached(font, word) > maxWidth) {
          // If we have a current line, push it first
          if (this.tempCurrentLine.trim()) {
            wrappedLines.push(this.tempCurrentLine.trim());
            this.tempCurrentLine = "";
          }

          // Break the long word using optimized binary search
          let remainingWord = word;
          while (remainingWord.length > 0) {
            const breakPoint = this.findWordBreakPoint(
              font,
              remainingWord,
              maxWidth
            );
            const piece = remainingWord.substring(0, breakPoint);
            wrappedLines.push(piece);
            remainingWord = remainingWord.substring(breakPoint);
          }
          continue;
        }

        // Test adding the next word
        this.tempTestLine = this.tempCurrentLine ? `${this.tempCurrentLine} ${word}` : word;
        const testWidth = this.measureTextCached(font, this.tempTestLine);

        if (testWidth <= maxWidth) {
          // Word fits on current line
          this.tempCurrentLine = this.tempTestLine;
        } else {
          // Word doesn't fit, start a new line
          if (this.tempCurrentLine.trim()) {
            wrappedLines.push(this.tempCurrentLine.trim());
          }
          this.tempCurrentLine = word;
        }
      }

      // Add the last line if it has content
      if (this.tempCurrentLine.trim()) {
        wrappedLines.push(this.tempCurrentLine.trim());
      }
    }

    return wrappedLines;
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

  /**
   * Clear all caches for memory management
   */
  clearCaches(): void {
    this.textMeasureCache.clear();
    this.maxBearingYCache.clear();
    this.graphemeCache.clear();
    
    // Clear pre-allocated arrays
    this.tempParagraphs.length = 0;
    this.tempWords.length = 0;
    this.tempCurrentLine = "";
    this.tempTestLine = "";
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): {
    textMeasureCache: number;
    maxBearingYCache: number;
    graphemeCache: number;
  } {
    return {
      textMeasureCache: this.textMeasureCache.size,
      maxBearingYCache: this.maxBearingYCache.size,
      graphemeCache: this.graphemeCache.size,
    };
  }
}
