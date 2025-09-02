// fonts-test.ts - Comprehensive test for the font system architecture

import { Content } from "../content/Content";
import { Canvas } from "../graphics/Canvas";
import { Color } from "../graphics/Color";
import { Logger } from "../utils/Logger";

const logger = Logger.getInstance();

/**
 * Test font loading and basic properties
 */
export async function testFontLoading(): Promise<void> {
  logger.info("=== Font Loading Test ===");
  
  try {
    // Create a temporary container for the test canvas
    const testContainer = document.createElement("div");
    testContainer.id = "test-container";
    document.body.appendChild(testContainer);
    
    // Initialize graphics system using Canvas (required for font loading)
    const canvas = new Canvas(100, 100, undefined, testContainer);
    await canvas.initialize();
    
    const content = Content.getInstance();
    
    // Test loading fonts from the fonts-test bundle
    const bundleLoaded = await content.loadBundle("fonts-test");
    
    if (!bundleLoaded) {
      throw new Error("Failed to load fonts-test bundle");
    }
    
    // Test each font type
    const fonts = [
      { id: "ui-font", name: "UI Font (Impact)" },
      { id: "title-font", name: "Title Font (Verdana)" },
      { id: "pixel-font", name: "Pixel Font (Monaco)" },
      { id: "snes-font", name: "SNES Font (File-based)" },
      { id: "custom-font", name: "Custom Font (Georgia)" }
    ];
    
    for (const fontInfo of fonts) {
      const font = content.getFont(fontInfo.id);
      if (font && font.isLoaded) {
        logger.info(`✓ ${fontInfo.name}: loaded successfully`);
        logger.info(`  Type: ${font.constructor.name}`);
        logger.info(`  Line Height: ${font.lineHeight}px`);
        logger.info(`  Glyphs: ${font.charset.length} characters`);
        
        // Test basic glyph access
        const testChar = 'A';
        const glyph = font.getGlyph(testChar);
        if (glyph) {
          logger.info(`  Glyph '${testChar}': ${glyph.width}x${glyph.height}px, advance: ${glyph.xAdvance}px`);
        }
      } else {
        logger.error(`✗ ${fontInfo.name}: failed to load or not found`);
      }
    }
    
    logger.info("Font loading test completed");
    
    // Clean up test container
    const cleanupContainer = document.getElementById("test-container");
    if (cleanupContainer) {
      document.body.removeChild(cleanupContainer);
    }
    
  } catch (error) {
    logger.error(`Font loading test failed: ${error}`);
    
    // Clean up on error too
    const cleanupContainer = document.getElementById("test-container");
    if (cleanupContainer) {
      document.body.removeChild(cleanupContainer);
    }
    
    throw error;
  }
}

/**
 * Test text measurement functionality
 */
export async function testFontMeasurement(): Promise<void> {
  logger.info("=== Font Measurement Test ===");
  
  try {
    // Create a temporary container for the test canvas
    const testContainer = document.createElement("div");
    testContainer.id = "test-container-measurement";
    document.body.appendChild(testContainer);
    
    // Initialize graphics system using Canvas if needed
    const canvas = new Canvas(100, 100, undefined, testContainer);
    await canvas.initialize();
    
    const content = Content.getInstance();
    
    // Ensure fonts are loaded
    await content.loadBundle("fonts-test");
    
    const font = content.getFont("ui-font");
    if (!font || !font.isLoaded) {
      throw new Error("UI font not loaded for measurement test");
    }
    
    const testTexts = [
      "Hello World",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
      "Text with\nmultiple\nlines",
      "123456789!@#$%^&*()",
      ""
    ];
    
    for (const text of testTexts) {
      const width = font.measureText(text);
      const lines = text.split('\n');
      logger.info(`Text: "${text.replace(/\n/g, '\\n')}"`);
      logger.info(`  Width: ${width}px`);
      logger.info(`  Lines: ${lines.length}`);
      logger.info(`  Height estimate: ${lines.length * font.lineHeight}px`);
    }
    
    // Test line-by-line measurement for multiline text
    const multilineText = "Line 1\nLine 2\nLine 3";
    const lines = multilineText.split('\n');
    logger.info("Line-by-line measurement:");
    for (let i = 0; i < lines.length; i++) {
      const lineWidth = font.measureText(lines[i]);
      logger.info(`  Line ${i + 1}: "${lines[i]}" = ${lineWidth}px wide`);
    }
    
    logger.info("Font measurement test completed");
    
    // Clean up test container
    const cleanupContainer = document.getElementById("test-container-measurement");
    if (cleanupContainer) {
      document.body.removeChild(cleanupContainer);
    }
    
  } catch (error) {
    logger.error(`Font measurement test failed: ${error}`);
    
    // Clean up on error too
    const cleanupContainer = document.getElementById("test-container-measurement");
    if (cleanupContainer) {
      document.body.removeChild(cleanupContainer);
    }
    
    throw error;
  }
}

/**
 * Test font rendering with different properties
 */
export async function testFontRendering(): Promise<void> {
  logger.info("=== Font Rendering Test ===");
  
  try {
    // Create a test canvas (this will initialize graphics)
    const canvas = new Canvas(800, 600);
    await canvas.initialize();
    
    const content = Content.getInstance();
    
    // Load fonts after graphics is initialized
    await content.loadBundle("fonts-test");
    
    // Test rendering with different fonts
    const fonts = [
      { id: "ui-font", color: Color.WHITE, y: 50 },
      { id: "title-font", color: Color.CYAN, y: 100 },
      { id: "pixel-font", color: Color.YELLOW, y: 150 },
      { id: "custom-font", color: Color.GREEN, y: 200 }
    ];
    
    canvas.backgroundColor = Color.fromHex("#1a1a2e");
    canvas.beginFrame();
    
    for (const fontTest of fonts) {
      const font = content.getFont(fontTest.id);
      if (font && font.isLoaded) {
        const testText = `${fontTest.id}: The quick brown fox jumps over the lazy dog`;
        canvas.drawText(testText, 20, fontTest.y, fontTest.color);
        logger.info(`✓ Rendered text with ${fontTest.id}`);
      } else {
        logger.warn(`✗ Could not render with ${fontTest.id} - font not loaded`);
      }
    }
    
    // Test multiline rendering
    const multilineText = "Multiline text test:\nLine 1\nLine 2\nLine 3";
    canvas.drawText(multilineText, 20, 300, Color.MAGENTA);
    
    // Test text with special characters
    const specialText = "Special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?";
    canvas.drawText(specialText, 20, 400, Color.ORANGE);
    
    canvas.endFrame();
    
    logger.info("Font rendering test completed - check the canvas for visual results");
    
    // Clean up after a delay
    setTimeout(() => {
      const canvasElement = document.getElementById("app-canvas");
      if (canvasElement && canvasElement.parentElement) {
        canvasElement.parentElement.removeChild(canvasElement);
      }
    }, 5000);
    
  } catch (error) {
    logger.error(`Font rendering test failed: ${error}`);
    throw error;
  }
}

/**
 * Test font atlas and texture generation
 */
export async function testFontAtlas(): Promise<void> {
  logger.info("=== Font Atlas Test ===");
  
  try {
    // Create a temporary container for the test canvas
    const testContainer = document.createElement("div");
    testContainer.id = "test-container-atlas";
    document.body.appendChild(testContainer);
    
    // Initialize graphics system using Canvas if needed
    const canvas = new Canvas(100, 100, undefined, testContainer);
    await canvas.initialize();
    
    const content = Content.getInstance();
    
    // Ensure fonts are loaded
    await content.loadBundle("fonts-test");
    
    const font = content.getFont("ui-font");
    if (!font || !font.isLoaded) {
      throw new Error("UI font not loaded for atlas test");
    }
    
    logger.info(`Font texture: ${font.texture ? 'Generated' : 'Not available'}`);
    
    if (font.texture) {
      logger.info(`  Texture size: ${font.texture.width}x${font.texture.height}px`);
      logger.info(`  Texture ID: ${font.texture.id}`);
    }
    
    // Test glyph atlas access
    const testChars = ['A', 'B', 'C', 'a', 'b', 'c', '1', '2', '3', '!', '@', '#'];
    logger.info("Glyph atlas data:");
    
    for (const char of testChars) {
      const glyph = font.getGlyph(char);
      if (glyph) {
        logger.info(`  '${char}': Region(${glyph.region.x}, ${glyph.region.y}, ${glyph.region.width}x${glyph.region.height}) Size(${glyph.width}x${glyph.height})`);
      } else {
        logger.warn(`  '${char}': No glyph data available`);
      }
    }
    
    logger.info("Font atlas test completed");
    
    // Clean up test container
    const cleanupContainer = document.getElementById("test-container-atlas");
    if (cleanupContainer) {
      document.body.removeChild(cleanupContainer);
    }
    
  } catch (error) {
    logger.error(`Font atlas test failed: ${error}`);
    
    // Clean up on error too
    const cleanupContainer = document.getElementById("test-container-atlas");
    if (cleanupContainer) {
      document.body.removeChild(cleanupContainer);
    }
    
    throw error;
  }
}

/**
 * Test font performance with large text rendering
 */
export async function testFontPerformance(): Promise<void> {
  logger.info("=== Font Performance Test ===");
  
  try {
    // Create a temporary container for the test canvas
    const testContainer = document.createElement("div");
    testContainer.id = "test-container-performance";
    document.body.appendChild(testContainer);
    
    // Initialize graphics system using Canvas if needed
    const canvas = new Canvas(100, 100, undefined, testContainer);
    await canvas.initialize();
    
    const content = Content.getInstance();
    
    // Ensure fonts are loaded
    await content.loadBundle("fonts-test");
    
    const font = content.getFont("ui-font");
    if (!font || !font.isLoaded) {
      throw new Error("UI font not loaded for performance test");
    }
    
    // Generate test text
    const loremIpsum = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20);
    const testTexts = [];
    for (let i = 0; i < 100; i++) {
      testTexts.push(`Line ${i + 1}: ${loremIpsum}`);
    }
    
    // Test measurement performance
    const measureStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      const text = testTexts[i % testTexts.length];
      font.measureText(text);
    }
    const measureEnd = performance.now();
    const measureTime = measureEnd - measureStart;
    
    logger.info(`Text measurement performance:`);
    logger.info(`  1000 measurements in ${measureTime.toFixed(2)}ms`);
    logger.info(`  Average: ${(measureTime / 1000).toFixed(3)}ms per measurement`);
    
    // Test repeated measurement caching (if implemented)
    const cacheTestText = "This text should be cached after first measurement";
    const cacheStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      font.measureText(cacheTestText);
    }
    const cacheEnd = performance.now();
    const cacheTime = cacheEnd - cacheStart;
    
    logger.info(`Repeated measurement performance (potential caching):`);
    logger.info(`  1000 repeated measurements in ${cacheTime.toFixed(2)}ms`);
    logger.info(`  Average: ${(cacheTime / 1000).toFixed(3)}ms per measurement`);
    
    if (cacheTime < measureTime * 0.5) {
      logger.info("✓ Significant performance improvement detected - caching likely working");
    } else {
      logger.info("• No significant caching performance improvement detected");
    }
    
    logger.info("Font performance test completed");
    
    // Clean up test container
    const cleanupContainer = document.getElementById("test-container-performance");
    if (cleanupContainer) {
      document.body.removeChild(cleanupContainer);
    }
    
  } catch (error) {
    logger.error(`Font performance test failed: ${error}`);
    
    // Clean up on error too
    const cleanupContainer = document.getElementById("test-container-performance");
    if (cleanupContainer) {
      document.body.removeChild(cleanupContainer);
    }
    
    throw error;
  }
}

/**
 * Run all font tests
 */
export async function testAllFonts(): Promise<void> {
  logger.info("=== Running All Font Tests ===");
  
  try {
    await testFontLoading();
    await testFontMeasurement();
    await testFontAtlas();
    await testFontPerformance();
    await testFontRendering(); // Run rendering test last as it creates DOM elements
    
    logger.info("✓ All font tests completed successfully");
    
  } catch (error) {
    logger.error(`Font tests failed: ${error}`);
    throw error;
  }
}