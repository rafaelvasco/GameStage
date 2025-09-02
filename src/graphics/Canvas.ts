// Canvas.ts - Canvas wrapper that uses Graphics abstraction

import { Graphics, GraphicsBackendType, ActualBackendType } from "./Graphics";
import { RenderingStats } from "./IGraphicsContext";
import { Color } from "./Color";
import { Texture2D } from "../content/image/Texture2D";
import { Content } from "../content/Content";
import { Logger, Matrix } from "../utils";
import { CanvasManager } from "../utils/CanvasManager";
import { TextureRegion } from "./TextureRegion";
import { Bitmap } from "./Bitmap";
import { Blitter } from "./swgfx/Blitter";
import { Font } from "../content/font/Font";
import { DefaultFont } from "../content/builtin/DefaultFont";
import { TextRenderingUtils } from "./TextRenderingUtils";
import { QuadRenderer } from "./renderers/QuadRenderer";
import { PrimitiveRenderer } from "./renderers/PrimitiveRenderer";
import { TextRenderer } from "./renderers/TextRenderer";
import { Transform } from "./Transform";

/**
 * High-level canvas wrapper for 2D sprite rendering with graphics backend abstraction.
 *
 * Features:
 * - Backend-agnostic API (works with WebGPU and WebGL2)
 * - Transform stack with push/pop operations
 * - Sprite rendering with pivot points, scaling, rotation, and texture regions
 * - Primitive drawing using 1x1 white texture
 * - Performance-optimized with cached matrices and vertex arrays
 * - Automatic canvas element creation and DOM management
 *
 * @example
 * ```typescript
 * const canvas = new Canvas(800, 600);
 * await canvas.initialize();
 *
 * canvas.backgroundColor = Color.BLACK;
 * canvas.beginFrame();
 * canvas.drawQuad(texture, x, y);
 * canvas.drawRect(10, 10, 100, 50, Color.red);
 * canvas.endFrame();
 * ```
 */
export class Canvas {
  private graphics: Graphics;
  private initialized: boolean = false;
  private canvasElement: HTMLCanvasElement;
  private logger: Logger;
  private textUtils: TextRenderingUtils;

  // Specialized renderers using composition pattern
  private quadRenderer: QuadRenderer;
  private primitiveRenderer: PrimitiveRenderer;
  private textRenderer: TextRenderer;

  // Background color for clearing the canvas
  public backgroundColor: Color = Color.BLACK;

  // Transform context identifier for this Canvas instance
  private transformContextId: string;

  // Cached arrays for performance
  private cachedCorners: Float32Array = new Float32Array(8); // 4 corners * 2 coordinates
  private cachedTransformedCorners: Float32Array = new Float32Array(8);
  private cachedUVRegion: Float32Array = new Float32Array([0.0, 0.0, 1.0, 1.0]); // u1, v1, u2, v2 for full texture
  private cachedCalculatedUVRegion: Float32Array = new Float32Array(4); // u1, v1, u2, v2 for calculated regions
  
  // Pre-allocated objects for coordinate transformations to avoid GC pressure
  private readonly tempCoordinateResult: { x: number; y: number } = { x: 0, y: 0 };
  private cachedVertexColors: Uint32Array = new Uint32Array([
    0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
  ]);
  private vertexColors: Uint32Array = new Uint32Array(4); // For custom color rendering

  // Projection matrix caching
  private cachedProjectionMatrix: Float32Array | null = null;

  private cachedCanvasWidth: number = -1;
  private cachedCanvasHeight: number = -1;

  // 1x1 white texture for primitive drawing
  private whiteTexture: Texture2D | null = null;

  // Default font instance
  private defaultFont: Font = null!;

  // Current font for text rendering
  private currentFont: Font = null!;

  // Debug mode flag
  private debugMode: boolean;

  /**
   * Create a new Canvas instance with the specified dimensions and backend preference
   * @param canvasWidth - Width of the canvas in pixels
   * @param canvasHeight - Height of the canvas in pixels
   * @param preferredBackend - Preferred graphics backend (Auto, WebGPU, or WebGL2)
   * @param parentElement - Optional parent element to append canvas to (defaults to #app)
   * @param debugMode - Enable debugging features (default: false)
   */
  constructor(
    canvasWidth: number,
    canvasHeight: number,
    preferredBackend: GraphicsBackendType = GraphicsBackendType.Auto,
    parentElement?: HTMLElement | string,
    debugMode: boolean = false
  ) {
    // Validate canvas dimensions
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      throw new Error(
        `Canvas dimensions must be positive: ${canvasWidth}x${canvasHeight}`
      );
    }

    this.debugMode = debugMode;
    this.graphics = Graphics.getInstance(preferredBackend);
    this.logger = Logger.getInstance();
    this.textUtils = TextRenderingUtils.getInstance();

    // Initialize Transform system if not already done
    Transform.initialize();

    // Create unique transform context for this Canvas instance
    this.transformContextId = `canvas_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
    Transform.createContext(this.transformContextId);

    // Initialize specialized renderers
    this.quadRenderer = new QuadRenderer();
    this.primitiveRenderer = new PrimitiveRenderer();
    this.textRenderer = new TextRenderer();

    // Create canvas element
    const canvasManager = CanvasManager.getInstance();
    const canvasResult = canvasManager.createMainCanvas(canvasWidth, canvasHeight, "app-canvas");
    this.canvasElement = canvasResult.canvas;

    // Find the parent container and append the canvas
    let container: HTMLElement | null = null;

    if (parentElement) {
      if (typeof parentElement === "string") {
        container = document.getElementById(parentElement);
      } else {
        container = parentElement;
      }
    } else {
      container = document.getElementById("app");
    }

    if (container) {
      container.appendChild(this.canvasElement);
    } else {
      // Log warning instead of throwing - canvas can still be used programmatically
      console.warn(
        `Canvas: Could not find parent container ${
          typeof parentElement === "string" ? parentElement : "#app"
        }. Canvas element created but not added to DOM.`
      );
    }

    // Transform is already initialized by Transform.createContext()
  }

  /**
   * Initialize the graphics context and prepare for rendering
   * @returns Promise that resolves to true if initialization succeeded, false otherwise
   */
  async initialize(): Promise<boolean> {
    this.logger.info(
      "Initializing Canvas graphics context...",
      Color.fromHex("#00AAFF")
    );

    // Initialize the graphics system using the canvas element ID
    const graphicsInitialized = await this.graphics.initialize(
      this.canvasElement.id
    );
    if (!graphicsInitialized) {
      this.logger.error(
        "Failed to initialize graphics system",
        Color.fromHex("#FF4444")
      );
      return false;
    }

    // Create 1x1 white texture for primitive drawing
    try {
      await this.createWhiteTexture();
    } catch (error) {
      this.logger.error(
        `Failed to create white texture: ${error}`,
        Color.fromHex("#FF4444")
      );
      return false;
    }

    // Initialize default font
    try {
      await this.initializeDefaultFont();
    } catch (error) {
      this.logger.error(
        `Failed to initialize default font: ${error}`,
        Color.fromHex("#FF4444")
      );
      return false;
    }

    // Initialize renderers with shared resources
    this.initializeRenderers();

    this.initialized = true;
    this.logger.success(
      `Canvas initialized with ${this.graphics.backendType.toUpperCase()} backend`,
      Color.fromHex("#44FF44")
    );
    
    if (this.debugMode) {
      this.logger.debug("Canvas initialized with debug mode enabled");
    }
    return true;
  }

  /**
   * Initialize all renderers with shared Canvas resources
   */
  private initializeRenderers(): void {
    const getCurrentTransform = () =>
      Transform.getCurrentTransform(this.transformContextId)!;
    const getCachedArrays = () => ({
      corners: this.cachedCorners,
      transformedCorners: this.cachedTransformedCorners,
      uvRegion: this.cachedUVRegion,
      calculatedUVRegion: this.cachedCalculatedUVRegion,
      vertexColors: this.vertexColors,
      cachedVertexColors: this.cachedVertexColors,
    });

    // Initialize base renderers
    this.quadRenderer.initialize(
      this.graphics,
      this.whiteTexture!,
      this.logger,
      getCurrentTransform,
      getCachedArrays
    );

    this.primitiveRenderer.initialize(
      this.graphics,
      this.whiteTexture!,
      this.logger,
      getCurrentTransform,
      getCachedArrays
    );

    this.textRenderer.initialize(
      this.graphics,
      this.whiteTexture!,
      this.logger,
      getCurrentTransform,
      getCachedArrays
    );

    // Set up renderer dependencies
    this.primitiveRenderer.initializeWithQuadRenderer(this.quadRenderer);
    this.textRenderer.initializeWithDependencies(
      this.textUtils,
      this.quadRenderer
    );
  }

  /**
   * Begin a new frame for rendering
   */
  beginFrame(): void {
    if (!this.initialized) {
      this.logger.error(
        "Canvas beginFrame: Canvas not properly initialized",
        Color.fromHex("#FF4444")
      );
      return;
    }

    // Clear transform stack at start of each frame to prevent accumulation
    Transform.clearStack(this.transformContextId);

    // Check if canvas size changed and update projection matrix if needed
    // For pixel-perfect rendering, use physical canvas dimensions to avoid scaling
    const currentWidth = this.width;
    const currentHeight = this.height;

    if (
      this.cachedCanvasWidth !== currentWidth ||
      this.cachedCanvasHeight !== currentHeight ||
      !this.cachedProjectionMatrix
    ) {
      this.cachedProjectionMatrix = Matrix.createOrthographic(
        0,
        currentWidth,
        currentHeight,
        0,
        -1,
        1
      );
      this.cachedCanvasWidth = currentWidth;
      this.cachedCanvasHeight = currentHeight;
    }

    this.graphics.beginFrame(this.backgroundColor, this.cachedProjectionMatrix);
  }

  /**
   * End the current frame and submit commands
   */
  endFrame(): void {
    if (!this.initialized) {
      this.logger.error(
        "Canvas endFrame: Canvas not properly initialized",
        Color.fromHex("#FF4444")
      );
      return;
    }
    this.graphics.endFrame();
  }

  /**
   * Push the current transform onto the stack and create a copy for modification
   * Use this to save the current transform state before making temporary changes.
   * Always pair with popTransform() to restore the previous state.
   */
  pushTransform(): void {
    Transform.pushTransform(this.transformContextId);
  }

  /**
   * Pop the previous transform from the stack and restore it as current
   * Use this to restore the transform state that was saved with pushTransform().
   * Logs a warning if the transform stack is empty instead of throwing
   */
  popTransform(): void {
    Transform.popTransform(this.transformContextId);
  }

  /**
   * Reset transform to identity matrix (no translation, rotation, or scaling)
   * This clears all current transform operations and returns to the default state.
   */
  resetTransform(): void {
    Transform.resetTransform(this.transformContextId);
  }

  /**
   * Translate the current transform by the specified offset
   * @param x - Horizontal translation offset in pixels
   * @param y - Vertical translation offset in pixels
   */
  translate(x: number, y: number): void {
    Transform.translate(this.transformContextId, x, y);
  }

  /**
   * Scale the current transform by the specified factors
   * @param x - Horizontal scale factor (1.0 = no change, 2.0 = double width, 0.5 = half width)
   * @param y - Vertical scale factor (1.0 = no change, 2.0 = double height, 0.5 = half height)
   */
  scale(x: number, y: number): void {
    Transform.scale(this.transformContextId, x, y);
  }

  /**
   * Rotate the current transform by the specified angle
   * @param angle - Rotation angle in radians (positive = clockwise, negative = counter-clockwise)
   */
  rotate(angle: number): void {
    Transform.rotate(this.transformContextId, angle);
  }

  /**
   * Execute a function with a temporary transform scope (exception-safe)
   * Automatically pushes before and pops after the operation
   * @param operation - Function to execute within the transform scope
   * @returns The result of the operation
   */
  withTransform<T>(operation: () => T): T {
    return Transform.withTransform(this.transformContextId, operation);
  }

  // =======================================================================
  // Quad Drawing Drawing Methods
  // =======================================================================

  /**
   * Draw a quad with basic parameters (position only)
   * @param texture - The texture to draw
   * @param x - X position in pixels
   * @param y - Y position in pixels
   * @param color - Optional color tint (default: white)
   */
  drawQuad(texture: Texture2D, x: number, y: number, color?: Color): void {
    this.quadRenderer.drawQuad(texture, x, y, color);
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
    this.quadRenderer.drawQuadEx(
      texture,
      x,
      y,
      color,
      width,
      height,
      pivotX,
      pivotY,
      region,
      rotation,
      scaleX,
      scaleY
    );
  }

  /**
   * Clear all caches (useful for memory management or when context changes)
   * Resets cached projection matrices, canvas dimensions, and color state
   */
  clearCaches(): void {
    this.cachedProjectionMatrix = null;
    this.cachedCanvasWidth = -1;
    this.cachedCanvasHeight = -1;
    this.textUtils.clearCaches();
    this.quadRenderer.resetColorCache();
    Transform.clearStack(this.transformContextId);
  }

  /**
   * Get transform performance statistics for this Canvas instance
   * @returns Transform system statistics
   */
  getTransformStats(): ReturnType<typeof Transform.getStats> {
    return Transform.getStats();
  }

  /**
   * Get the transform context ID for this Canvas instance
   * Useful for advanced transform operations or debugging
   * @returns The transform context identifier
   */
  getTransformContextId(): string {
    return this.transformContextId;
  }

  /**
   * Get the center point of the canvas considering the current transform
   * This applies the inverse transform to the canvas center to get the world-space center
   * @returns Object with x and y coordinates of the center point in world space
   */
  getCenterPoint(): { x: number; y: number } {
    const canvasCenterX = this.width / 2;
    const canvasCenterY = this.height / 2;

    // Get cached inverse transform from Transform system
    const inverseTransform = Transform.getCurrentTransformInverse(
      this.transformContextId
    );
    if (!inverseTransform) {
      // If no transform context or transform is not invertible, return canvas center as-is
      this.tempCoordinateResult.x = canvasCenterX;
      this.tempCoordinateResult.y = canvasCenterY;
      return this.tempCoordinateResult;
    }

    // Apply inverse transform to canvas center to get world-space center
    const worldCenter = Matrix.transformPoint(
      inverseTransform,
      canvasCenterX,
      canvasCenterY
    );

    this.tempCoordinateResult.x = worldCenter.x;
    this.tempCoordinateResult.y = worldCenter.y;
    return this.tempCoordinateResult;
  }

  /**
   * Transform a global (world) point to local (canvas) coordinates
   * This applies the current transform to convert from world space to canvas space
   * @param x - Global X coordinate
   * @param y - Global Y coordinate
   * @returns Object with x and y coordinates in local canvas space
   */
  globalToLocal(x: number, y: number): { x: number; y: number } {
    const currentTransform = Transform.getCurrentTransform(
      this.transformContextId
    );
    if (!currentTransform) {
      // If no transform context, coordinates are the same
      this.tempCoordinateResult.x = x;
      this.tempCoordinateResult.y = y;
      return this.tempCoordinateResult;
    }

    // Apply current transform to convert global to local coordinates
    const localPoint = Matrix.transformPoint(currentTransform, x, y);

    this.tempCoordinateResult.x = localPoint.x;
    this.tempCoordinateResult.y = localPoint.y;
    return this.tempCoordinateResult;
  }

  /**
   * Transform a local (canvas) point to global (world) coordinates
   * This applies the inverse transform to convert from canvas space to world space
   * @param x - Local X coordinate
   * @param y - Local Y coordinate
   * @returns Object with x and y coordinates in global world space, or original coordinates if transform not invertible
   */
  localToGlobal(x: number, y: number): { x: number; y: number } {
    // Get cached inverse transform from Transform system
    const inverseTransform = Transform.getCurrentTransformInverse(
      this.transformContextId
    );
    if (!inverseTransform) {
      // If no transform context or transform is not invertible, coordinates are the same
      this.tempCoordinateResult.x = x;
      this.tempCoordinateResult.y = y;
      return this.tempCoordinateResult;
    }

    // Apply inverse transform to convert local to global coordinates
    const globalPoint = Matrix.transformPoint(inverseTransform, x, y);

    this.tempCoordinateResult.x = globalPoint.x;
    this.tempCoordinateResult.y = globalPoint.y;
    return this.tempCoordinateResult;
  }

  /**
   * Destroy this Canvas instance and clean up its resources
   * Call this when the Canvas is no longer needed to prevent memory leaks
   */
  destroy(): void {
    // Destroy the transform context
    Transform.destroyContext(this.transformContextId);

    // Remove canvas from DOM if it was added
    if (this.canvasElement.parentElement) {
      this.canvasElement.parentElement.removeChild(this.canvasElement);
    }

    this.logger.info(
      `Canvas instance destroyed (context: ${this.transformContextId})`
    );
  }

  // =======================================================================
  // Primitive Drawing Methods
  // =======================================================================

  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
    lineWidth: number = 1
  ): void {
    this.primitiveRenderer.drawRect(x, y, width, height, color, lineWidth);
  }

  fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color
  ): void {
    this.primitiveRenderer.fillRect(x, y, width, height, color);
  }

  fillRectEx(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    this.primitiveRenderer.fillRectEx(x, y, width, height, color, rotation, scaleX, scaleY);
  }

  drawCircle(
    x: number,
    y: number,
    radius: number,
    color: Color,
    lineWidth: number = 1,
    segments?: number
  ): void {
    this.primitiveRenderer.drawCircle(x, y, radius, color, lineWidth, segments);
  }

  fillCircle(x: number, y: number, radius: number, color: Color): void {
    this.primitiveRenderer.fillCircle(x, y, radius, color);
  }

  fillCircleEx(
    x: number,
    y: number,
    radius: number,
    color: Color,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    this.primitiveRenderer.fillCircleEx(x, y, radius, color, rotation, scaleX, scaleY);
  }

  drawCircleEx(
    x: number,
    y: number,
    radius: number,
    color: Color,
    strokeWidth: number = 1,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    this.primitiveRenderer.drawCircleEx(x, y, radius, color, strokeWidth, rotation, scaleX, scaleY);
  }

  drawRectEx(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
    strokeWidth: number = 1,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    this.primitiveRenderer.drawRectEx(x, y, width, height, color, strokeWidth, rotation, scaleX, scaleY);
  }

  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: Color,
    lineWidth: number = 1
  ): void {
    this.primitiveRenderer.drawLine(x1, y1, x2, y2, color, lineWidth);
  }

  drawPoint(x: number, y: number, color: Color): void {
    this.primitiveRenderer.drawPoint(x, y, color);
  }

  drawTriangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    color: Color,
    lineWidth: number = 1
  ): void {
    this.primitiveRenderer.drawTriangle(
      x1,
      y1,
      x2,
      y2,
      x3,
      y3,
      color,
      lineWidth
    );
  }

  fillTriangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    color: Color
  ): void {
    this.primitiveRenderer.fillTriangle(x1, y1, x2, y2, x3, y3, color);
  }

  fillTriangleEx(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    color: Color,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    this.primitiveRenderer.fillTriangleEx(x1, y1, x2, y2, x3, y3, color, rotation, scaleX, scaleY);
  }

  drawTriangleEx(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    color: Color,
    lineWidth: number = 1,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    this.primitiveRenderer.drawTriangleEx(x1, y1, x2, y2, x3, y3, color, lineWidth, rotation, scaleX, scaleY);
  }

  drawLineEx(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: Color,
    lineWidth: number = 1,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    this.primitiveRenderer.drawLineEx(x1, y1, x2, y2, color, lineWidth, rotation, scaleX, scaleY);
  }

  drawOval(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    color: Color,
    lineWidth: number = 1,
    segments?: number
  ): void {
    this.primitiveRenderer.drawOval(
      x,
      y,
      radiusX,
      radiusY,
      color,
      lineWidth,
      segments
    );
  }

  fillOval(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    color: Color
  ): void {
    this.primitiveRenderer.fillOval(x, y, radiusX, radiusY, color);
  }

  drawEquilateralTriangle(
    centerX: number,
    centerY: number,
    sideLength: number,
    color: Color,
    lineWidth: number = 1,
    rotation: number = 0
  ): void {
    this.primitiveRenderer.drawEquilateralTriangle(
      centerX,
      centerY,
      sideLength,
      color,
      lineWidth,
      rotation
    );
  }

  fillEquilateralTriangle(
    centerX: number,
    centerY: number,
    sideLength: number,
    color: Color,
    rotation: number = 0
  ): void {
    this.primitiveRenderer.fillEquilateralTriangle(
      centerX,
      centerY,
      sideLength,
      color,
      rotation
    );
  }

  drawEquilateralTriangleFromBase(
    baseX: number,
    baseY: number,
    sideLength: number,
    color: Color,
    lineWidth: number = 1,
    pointingUp: boolean = true
  ): void {
    this.primitiveRenderer.drawEquilateralTriangleFromBase(
      baseX,
      baseY,
      sideLength,
      color,
      lineWidth,
      pointingUp
    );
  }

  fillEquilateralTriangleFromBase(
    baseX: number,
    baseY: number,
    sideLength: number,
    color: Color,
    pointingUp: boolean = true
  ): void {
    this.primitiveRenderer.fillEquilateralTriangleFromBase(
      baseX,
      baseY,
      sideLength,
      color,
      pointingUp
    );
  }

  // =======================================================================
  // Text Drawing Methods
  // =======================================================================

  /**
   * Set the current font for text rendering
   * @param font - The font to use for subsequent text drawing operations, or null to use default font
   */
  setFont(font: Font | null): void {
    this.currentFont = font || this.defaultFont;
  }

  /**
   * Get the current font being used for text rendering
   * @returns The current font, or null if no font is set
   */
  getCurrentFont(): Font {
    return this.currentFont;
  }

  /**
   * Draw text using the current font with kerning support
   * @param text - The text to draw
   * @param x - X position (left edge of text)
   * @param y - Y position (top of text, top-left pivot)
   * @param color - Text color (default: white)
   */
  drawText(
    text: string,
    x: number,
    y: number,
    color: Color = Color.WHITE
  ): void {
    this.textRenderer.drawText(this.currentFont, text, x, y, color);
  }

  /**
   * Draw text with alignment and scaling options using the current font
   * @param text - The text to draw
   * @param x - X position
   * @param y - Y position
   * @param color - Text color (default: white)
   * @param align - Text alignment ('left', 'center', 'right')
   */
  drawTextEx(
    text: string,
    x: number,
    y: number,
    color: Color = Color.WHITE,
    align: "left" | "center" | "right" = "left"
  ): void {
    this.textRenderer.drawTextEx(this.currentFont, text, x, y, color, align);
  }

  /**
   * Draw text within a rectangular area with word wrapping using the current font
   * @param text - The text to draw
   * @param x - X position of the text area
   * @param y - Y position of the text area
   * @param width - Width of the text area
   * @param height - Height of the text area
   * @param color - Text color (default: white)
   * @param options - Additional formatting options
   * @returns Object with lines drawn, total height, and whether text was clipped
   */
  drawTextArea(
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
    } = {}
  ): {
    lines: string[];
    totalHeight: number;
    clipped: boolean;
  } {
    return this.textRenderer.drawTextArea(
      this.currentFont,
      text,
      x,
      y,
      width,
      height,
      color,
      options,
      () => this.pushTransform(),
      () => this.popTransform()
    );
  }

  /**
   * Measure text size with kerning using the current font
   * @param text - The text to measure
   * @returns Object with width and height in pixels
   */
  measureText(text: string): { width: number; height: number } {
    return this.textRenderer.measureText(this.currentFont, text);
  }

  /**
   * Log detailed information about the graphics backend
   * Prints backend type, capabilities, and performance information to console
   */
  logBackendInfo(): void {
    this.graphics.logBackendInfo();
  }

  /**
   * Get the current graphics backend type that is actually being used
   * @returns The actual backend type (WebGPU or WebGL2)
   */
  get backendType(): ActualBackendType {
    return this.graphics.backendType;
  }

  /**
   * Get the underlying HTML canvas element
   * @returns The HTMLCanvasElement used for rendering
   */
  get canvas(): HTMLCanvasElement {
    return this.graphics.canvas;
  }

  /**
   * Get the current canvas width in pixels
   * @returns Canvas width in pixels
   */
  get width(): number {
    return this.graphics.canvas.width;
  }

  /**
   * Get the current canvas height in pixels
   * @returns Canvas height in pixels
   */
  get height(): number {
    return this.graphics.canvas.height;
  }

  /**
   * Get the requested graphics backend type (what was originally requested)
   * @returns The originally requested backend type (Auto, WebGPU, or WebGL2)
   */
  get requestedBackendType(): GraphicsBackendType {
    return this.graphics.requestedBackendType;
  }

  /**
   * Get comprehensive rendering statistics for debugging and performance monitoring
   */
  getRenderingStats(): RenderingStats {
    return this.graphics.getRenderingStats();
  }

  /**
   * Initialize the default font
   */
  private async initializeDefaultFont(): Promise<void> {
    try {
      this.defaultFont = await DefaultFont.getInstance();
      this.currentFont = this.defaultFont; // Set as current font
      
      // Ensure the font texture is created for rendering
      await this.defaultFont.getTexture();
      
      this.logger.debug("Default font initialized successfully");
    } catch (error) {
      this.logger.error(`Error initializing default font: ${error}`);
      throw error;
    }
  }

  /**
   * Create a 1x1 white texture for primitive drawing
   */
  private async createWhiteTexture(): Promise<void> {
    try {
      // Use the unified Bitmap class to create a 1x1 white texture
      const bitmap = Bitmap.create(1, 1);
      const whiteColor = Bitmap.rgba(255, 255, 255, 255);
      const blitter = Blitter.getInstance();
      blitter.setTarget(bitmap);
      blitter.fill(whiteColor);

      // Create texture using the Content system
      const content = Content.getInstance();

      this.whiteTexture = await content.createTexture2D(
        "white_primitive_texture",
        bitmap.imageData
      );

      if (!this.whiteTexture) {
        throw new Error("White texture creation returned null");
      }

      if (!this.whiteTexture.isLoaded) {
        this.logger.warn(
          "White texture created but not loaded, checking backend texture..."
        );
        // The texture should be loaded immediately since we passed ImageData
        if (!this.whiteTexture.hasBackendTexture) {
          throw new Error("White texture backend texture is null");
        }
      }
    } catch (error) {
      this.logger.error(`Error in createWhiteTexture: ${error}`);
      this.logger.error("Stack trace:");
      console.error(error);
      throw error;
    }
  }

  /**
   * Clear all graphics caches (should only be used during shutdown or major state changes)
   */
  clearGraphicsCaches(): void {
    this.graphics.clearCaches();
  }

  /**
   * Perform lightweight cache maintenance (removes only stale entries)
   */
  maintainGraphicsCaches(): void {
    this.graphics.maintainCaches();
  }
}
