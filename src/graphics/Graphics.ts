// Graphics.ts - Graphics facade that manages the active graphics backend

import { IGraphicsContext, RenderingStats } from "./IGraphicsContext";
import { Color } from "./Color";
import { WebGPUGraphics } from "./webgpu/WebGPUGraphics";
import { WebGL2Graphics } from "./webgl2/WebGL2Graphics";
import { ITexture2D } from "./ITexture2D";
import { WebGPUTexture2D } from "./webgpu/WebGPUTexture2D";
import { WebGL2Texture2D } from "./webgl2/WebGL2Texture2D";
import { IShader } from "./IShader";
import { WebGPUShader } from "./webgpu/WebGPUShader";
import { WebGL2Shader } from "./webgl2/WebGL2Shader";
import { Logger } from "../utils/Logger";

export enum GraphicsBackendType {
  WebGPU = "webgpu",
  WebGL2 = "webgl2",
  Auto = "auto",
}

export type ActualBackendType = "webgpu" | "webgl2";

export class Graphics implements IGraphicsContext {
  private static instance: Graphics | null = null;
  private backend: IGraphicsContext;
  private logger: Logger;
  private requestedBackend: GraphicsBackendType;

  private constructor(
    preferredBackend: GraphicsBackendType = GraphicsBackendType.Auto
  ) {
    this.logger = Logger.getInstance();
    this.requestedBackend = preferredBackend;

    // Choose backend based on preference or browser support
    this.backend = this.selectBackend(preferredBackend);
  }

  private selectBackend(
    preferredBackend: GraphicsBackendType
  ): IGraphicsContext {
    if (preferredBackend === GraphicsBackendType.WebGPU) {
      if (navigator.gpu) {
        this.logger.info(
          "WebGPU backend forced by user preference",
          Color.fromHex("#00FF88")
        );
        return WebGPUGraphics.getInstance();
      } else {
        this.logger.warn(
          "WebGPU backend requested but not supported, falling back to WebGL2",
          Color.fromHex("#FFAA00")
        );
        return WebGL2Graphics.getInstance();
      }
    } else if (preferredBackend === GraphicsBackendType.WebGL2) {
      this.logger.info(
        "WebGL2 backend forced by user preference",
        Color.fromHex("#FFAA44")
      );
      return WebGL2Graphics.getInstance();
    } else {
      // Auto selection (current behavior)
      if (navigator.gpu) {
        this.logger.info(
          "WebGPU support detected, selecting WebGPU backend",
          Color.fromHex("#00FF88")
        );
        return WebGPUGraphics.getInstance();
      } else {
        this.logger.info(
          "WebGPU not available, falling back to WebGL2 backend",
          Color.fromHex("#FFAA00")
        );
        return WebGL2Graphics.getInstance();
      }
    }
  }

  static getInstance(
    preferredBackend: GraphicsBackendType = GraphicsBackendType.Auto
  ): Graphics {
    if (!Graphics.instance) {
      Graphics.instance = new Graphics(preferredBackend);
    } else if (
      preferredBackend !== GraphicsBackendType.Auto &&
      Graphics.instance.requestedBackend !== preferredBackend
    ) {
      // If a different backend is requested after instance creation, log a warning
      Graphics.instance.logger.warn(
        `Graphics instance already exists with ${Graphics.instance.requestedBackend} backend. Cannot change to ${preferredBackend}.`,
        Color.fromHex("#FFAA00")
      );
    }
    return Graphics.instance;
  }

  /**
   * Reset the Graphics singleton instance (useful for testing or backend switching)
   */
  static resetInstance(): void {
    // Also reset backend instances
    WebGL2Graphics.resetInstance();
    WebGPUGraphics.resetInstance();
    Graphics.instance = null;
  }

  // Delegate all methods to the active backend
  async initialize(canvasId: string): Promise<boolean> {
    const backendName = this.backendType.toUpperCase();
    this.logger.info(
      `Initializing ${backendName} graphics backend...`,
      Color.fromHex("#00AAFF")
    );

    const result = await this.backend.initialize(canvasId);

    if (result) {
      this.logger.success(
        `${backendName} graphics backend initialized successfully`,
        Color.fromHex("#44FF44")
      );
    } else {
      this.logger.error(
        `Failed to initialize ${backendName} graphics backend`,
        Color.fromHex("#FF4444")
      );
    }

    return result;
  }

  get isInitialized(): boolean {
    return this.backend.isInitialized;
  }

  get canvas(): HTMLCanvasElement {
    return this.backend.canvas;
  }

  createTextureFromImageData(
    imageData: ImageData | HTMLImageElement | ImageBitmap,
    usage?: number
  ): any {
    return this.backend.createTextureFromImageData(imageData, usage);
  }

  createSampler(
    magFilter?: string,
    minFilter?: string,
    addressModeU?: string,
    addressModeV?: string
  ): any {
    return this.backend.createSampler(
      magFilter,
      minFilter,
      addressModeU,
      addressModeV
    );
  }

  beginFrame(clearColor?: Color, projectionMatrix?: Float32Array): void {
    this.backend.beginFrame(clearColor, projectionMatrix);
  }

  endFrame(): void {
    this.backend.endFrame();
  }

  drawQuad(
    texture: any,
    sampler: any,
    vertices: Float32Array, // [ax, ay, bx, by, cx, cy, dx, dy] - 8 floats
    uvRegion: Float32Array, // [u1, v1, u2, v2] - 4 floats
    vertexColors: Uint32Array // [c1, c2, c3, c4] - 4 RGBA integers
  ): void {
    this.backend.drawQuad(texture, sampler, vertices, uvRegion, vertexColors);
  }

  flush(): void {
    this.backend.flush();
  }

  createCommandEncoder(label?: string): any {
    return this.backend.createCommandEncoder(label);
  }

  submitCommands(commandBuffers: any[]): void {
    this.backend.submitCommands(commandBuffers);
  }

  /**
   * Creates a backend-specific texture implementation
   */
  createTexture2D(): ITexture2D {
    if (this.backend instanceof WebGPUGraphics) {
      return new WebGPUTexture2D();
    } else if (this.backend instanceof WebGL2Graphics) {
      return new WebGL2Texture2D();
    } else {
      throw new Error("Unknown graphics backend");
    }
  }

  /**
   * Creates a backend-specific shader implementation
   */
  createShader(): IShader {
    if (this.backend instanceof WebGPUGraphics) {
      return new WebGPUShader();
    } else if (this.backend instanceof WebGL2Graphics) {
      return new WebGL2Shader();
    } else {
      throw new Error("Unknown graphics backend");
    }
  }

  /**
   * Gets the current graphics backend type
   */
  get backendType(): ActualBackendType {
    if (this.backend instanceof WebGPUGraphics) {
      return "webgpu";
    } else if (this.backend instanceof WebGL2Graphics) {
      return "webgl2";
    } else {
      throw new Error("Unknown graphics backend");
    }
  }

  /**
   * Log detailed information about the current graphics backend
   */
  logBackendInfo(): void {
    if (!this.isInitialized) {
      this.logger.warn(
        "Graphics backend not yet initialized",
        Color.fromHex("#FFAA00")
      );
      return;
    }

    const backendName = this.backendType.toUpperCase();
    this.logger.info(
      `=== ${backendName} Graphics Backend Information ===`,
      Color.fromHex("#00FFFF")
    );
    this.logger.info(`Backend Type: ${backendName}`, Color.fromHex("#00AAFF"));
    this.logger.info(
      `Requested Backend: ${this.requestedBackend.toUpperCase()}`,
      Color.fromHex("#00AAFF")
    );
    this.logger.info(
      `Canvas Size: ${this.canvas.width}x${this.canvas.height}`,
      Color.fromHex("#00AAFF")
    );
    this.logger.info(
      `Device Pixel Ratio: ${window.devicePixelRatio}`,
      Color.fromHex("#00AAFF")
    );

    if (this.backendType === GraphicsBackendType.WebGPU) {
      this.logger.info(
        "WebGPU Features: Advanced GPU compute and rendering",
        Color.fromHex("#44FF44")
      );
    } else {
      this.logger.info(
        "WebGL2 Features: Standard GPU rendering",
        Color.fromHex("#FFAA44")
      );
    }

    this.logger.info(
      "Graphics backend is ready for rendering",
      Color.fromHex("#44FF44")
    );
  }

  /**
   * Get the requested backend type
   */
  get requestedBackendType(): GraphicsBackendType {
    return this.requestedBackend;
  }

  /**
   * Get comprehensive rendering statistics for debugging and performance monitoring
   */
  getRenderingStats(): RenderingStats {
    return this.backend.getRenderingStats();
  }

  /**
   * Clear all caches (should only be used during shutdown or major state changes)
   */
  clearCaches(): void {
    this.backend.clearCaches();
  }

  /**
   * Perform lightweight cache maintenance (removes only stale entries)
   */
  maintainCaches(): void {
    this.backend.maintainCaches();
  }
}
