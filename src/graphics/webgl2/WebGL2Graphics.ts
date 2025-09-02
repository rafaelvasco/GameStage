// WebGL2Graphics.ts - WebGL2 implementation of the graphics context interface

import { IGraphicsContext, RenderingStats } from "../IGraphicsContext";
import { Color } from "../Color";
import { TexturedQuadShaderWebGL2 } from "./TexturedQuadShaderWebGL2";
import { Logger, Matrix } from "../../utils";
import { toast } from "../../utils/Toast";

interface WebGL2Context {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
}

interface BatchedQuad {
  texture: WebGLTexture;
  sampler: WebGLSampler;
  vertices: Float32Array; // [ax, ay, bx, by, cx, cy, dx, dy] - 8 floats
  uvRegion: Float32Array; // [u1, v1, u2, v2] - 4 floats
  vertexColors: Uint32Array; // [c1, c2, c3, c4] - 4 RGBA integers
}

export class WebGL2Graphics implements IGraphicsContext {
  private static instance: WebGL2Graphics | null = null;
  private webgl2Context: WebGL2Context | null = null;
  private initialized: boolean = false;
  private logger: Logger;
  private quadProgram: WebGLProgram | null = null;
  private quadVAO: WebGLVertexArrayObject | null = null;
  private quadVertexBuffer: WebGLBuffer | null = null;

  // Batched quad rendering system
  private static readonly MAX_QUADS = 1024;
  private static readonly VERTICES_PER_QUAD = 6;
  private static readonly BYTES_PER_VERTEX = 20; // position(8) + texCoord(8) + color(4)
  private static readonly BYTES_PER_QUAD =
    WebGL2Graphics.VERTICES_PER_QUAD * WebGL2Graphics.BYTES_PER_VERTEX;

  // Dynamic vertex buffer for batched quads
  private dynamicVertexBuffer: ArrayBuffer = new ArrayBuffer(
    WebGL2Graphics.MAX_QUADS * WebGL2Graphics.BYTES_PER_QUAD
  );
  private dynamicVertexView: DataView = new DataView(this.dynamicVertexBuffer);
  private dynamicVertexUint8: Uint8Array = new Uint8Array(
    this.dynamicVertexBuffer
  );

  // Enhanced batch state for smart texture sorting
  private pendingQuads: BatchedQuad[] = [];
  private frameInProgress: boolean = false;

  // Rendering statistics tracking
  private drawCallCount: number = 0;
  private batchCount: number = 0;
  private frameDrawCallCount: number = 0; // Current frame's draw calls
  private frameBatchCount: number = 0; // Current frame's batches

  // Note: Reusable arrays removed - using object pooling instead for better performance

  // Object pool for BatchedQuad objects to avoid allocations
  private quadPool: BatchedQuad[] = [];
  private poolIndex: number = 0;
  private static readonly QUAD_POOL_SIZE = 2048; // Double the max quads for safety

  // Pre-computed sort keys for faster sorting (avoids function calls in sort comparator)
  private sortKeys: number[] = [];
  private sortIndices: number[] = [];
  private tempQuadsForSorting: BatchedQuad[] = [];

  // Object ID tracking for consistent sorting
  private textureIdMap: WeakMap<WebGLTexture, number> = new WeakMap();
  private samplerIdMap: WeakMap<WebGLSampler, number> = new WeakMap();
  private nextTextureId: number = 1;
  private nextSamplerId: number = 1;

  // Cached identity matrix for performance
  private cachedIdentityMatrix: Float32Array = Matrix.createIdentity();

  // Cached objects for performance optimization
  private samplerCache: Map<string, WebGLSampler> = new Map();
  private static readonly MAX_SAMPLER_CACHE_SIZE = 64; // Reasonable limit for sampler combinations
  private cachedUniformLocations: {
    mvpMatrix: WebGLUniformLocation | null;
    texture: WebGLUniformLocation | null;
  } | null = null;

  // State tracking to avoid redundant GL calls
  private currentProgram: WebGLProgram | null = null;
  private currentTexture: WebGLTexture | null = null;
  private currentSampler: WebGLSampler | null = null;
  private currentVAO: WebGLVertexArrayObject | null = null;
  private currentBuffer: WebGLBuffer | null = null;
  private currentActiveTexture: number = -1;
  private currentViewportWidth: number = -1;
  private currentViewportHeight: number = -1;

  // Matrix change detection
  private cachedProjectionMatrix: Float32Array | null = null;
  private matrixNeedsUpdate: boolean = true;

  // Clear color caching
  private cachedClearColor: Color = Color.TRANSPARENT;

  private constructor() {
    this.logger = Logger.getInstance();

    // Initialize quad object pool
    this.initializeQuadPool();
  }

  /**
   * Initialize the object pool for BatchedQuad objects
   */
  private initializeQuadPool(): void {
    this.quadPool = new Array(WebGL2Graphics.QUAD_POOL_SIZE);
    for (let i = 0; i < WebGL2Graphics.QUAD_POOL_SIZE; i++) {
      this.quadPool[i] = {
        texture: null!,  // Will be assigned before use
        sampler: null!,  // Will be assigned before use
        vertices: new Float32Array(8),
        uvRegion: new Float32Array(4),
        vertexColors: new Uint32Array(4),
      };
    }
  }

  static getInstance(): WebGL2Graphics {
    if (!WebGL2Graphics.instance) {
      WebGL2Graphics.instance = new WebGL2Graphics();
    }
    return WebGL2Graphics.instance;
  }

  /**
   * Reset the WebGL2Graphics singleton instance (useful for testing)
   */
  static resetInstance(): void {
    if (WebGL2Graphics.instance) {
      // Clean up any resources if needed
      WebGL2Graphics.instance.clearCaches();
      WebGL2Graphics.instance = null;
    }
  }

  /**
   * Initialize the graphics system with WebGL2
   */
  async initialize(canvasId: string): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) {
        const error = `Canvas element with id '${canvasId}' not found`;
        this.logger.error(error, Color.fromHex("#FF4444"));
        return false;
      }

      // Get WebGL2 context
      this.logger.debug(
        "Requesting WebGL2 rendering context...",
        Color.fromHex("#888888")
      );
      const gl = canvas.getContext("webgl2");
      if (!gl) {
        const error =
          "WebGL2 is not supported in your browser. Please use a modern browser that supports WebGL2.";
        this.logger.error(error, Color.fromHex("#FF4444"));
        toast.error(error, {
          title: "WebGL2 Not Supported",
          icon: "🖥️",
        });
        return false;
      }

      this.logger.info(
        "WebGL2 context obtained successfully",
        Color.fromHex("#00AAFF")
      );

      // Log WebGL2 capabilities
      const renderer = gl.getParameter(gl.RENDERER);
      const vendor = gl.getParameter(gl.VENDOR);
      const version = gl.getParameter(gl.VERSION);

      this.logger.info(
        `WebGL2 Renderer: ${renderer}`,
        Color.fromHex("#00AAFF")
      );
      this.logger.info(`WebGL2 Vendor: ${vendor}`, Color.fromHex("#00AAFF"));
      this.logger.debug(`WebGL2 Version: ${version}`, Color.fromHex("#888888"));

      this.webgl2Context = {
        gl,
        canvas,
      };

      // Set up basic WebGL2 state
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Create quad program and VAO
      this.logger.debug(
        "Initializing WebGL2 quad pipeline...",
        Color.fromHex("#888888")
      );
      await this.initializeQuadPipeline();

      this.initialized = true;
      this.logger.success(
        "WebGL2 graphics backend initialized successfully",
        Color.fromHex("#44FF44")
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to initialize WebGL2 graphics backend: ${error}`,
        Color.fromHex("#FF4444")
      );
      return false;
    }
  }

  private getWebGL2Context(): WebGL2Context {
    if (!this.webgl2Context) {
      throw new Error("Graphics system not initialized");
    }
    return this.webgl2Context;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  private get gl(): WebGL2RenderingContext {
    return this.getWebGL2Context().gl;
  }

  get canvas(): HTMLCanvasElement {
    return this.getWebGL2Context().canvas;
  }

  /**
   * Get the WebGL2 rendering context for resource cleanup
   * @internal - This is for internal use by WebGL2 texture/shader implementations
   */
  getGL(): WebGL2RenderingContext | null {
    if (!this.isInitialized) {
      return null;
    }
    return this.gl;
  }

  /**
   * Creates a texture from image data
   */
  createTextureFromImageData(
    imageData: ImageData | HTMLImageElement | ImageBitmap,
    _usage: number = 0 // WebGL2 doesn't use usage flags like WebGPU
  ): WebGLTexture {
    const gl = this.gl;

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("Failed to create texture");
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Upload the image data
    if (imageData instanceof ImageData) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        imageData.width,
        imageData.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imageData.data
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imageData
      );
    }

    // Set default texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, null);

    return texture;
  }

  /**
   * Creates a sampler with common settings (cached for performance)
   */
  createSampler(
    magFilter: string = "nearest",
    minFilter: string = "nearest",
    addressModeU: string = "clamp-to-edge",
    addressModeV: string = "clamp-to-edge"
  ): WebGLSampler {
    const cacheKey = `${magFilter}_${minFilter}_${addressModeU}_${addressModeV}`;

    let sampler = this.samplerCache.get(cacheKey);
    if (!sampler) {
      const gl = this.gl;

      // Check if cache is at capacity and needs cleanup
      if (this.samplerCache.size >= WebGL2Graphics.MAX_SAMPLER_CACHE_SIZE) {
        // Remove oldest entry (first in Map iteration order)
        const firstKey = this.samplerCache.keys().next().value;
        if (firstKey) {
          const oldSampler = this.samplerCache.get(firstKey);
          if (oldSampler) {
            gl.deleteSampler(oldSampler); // Clean up WebGL resource
          }
          this.samplerCache.delete(firstKey);
        }
      }

      sampler = gl.createSampler();
      if (!sampler) {
        throw new Error("Failed to create sampler");
      }

      // Convert string parameters to WebGL constants
      const magFilterGL = magFilter === "linear" ? gl.LINEAR : gl.NEAREST;
      const minFilterGL = minFilter === "linear" ? gl.LINEAR : gl.NEAREST;
      const wrapSGL = addressModeU === "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      const wrapTGL = addressModeV === "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE;

      gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, magFilterGL);
      gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, minFilterGL);
      gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, wrapSGL);
      gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, wrapTGL);

      this.samplerCache.set(cacheKey, sampler);
    }

    return sampler;
  }

  /**
   * Loads an image from a URL
   */
  /**
   * Creates a command encoder (WebGL2 doesn't have command encoders, return null)
   */
  createCommandEncoder(_label?: string): null {
    // WebGL2 doesn't use command encoders like WebGPU
    return null;
  }

  /**
   * Submits command buffers (WebGL2 doesn't use command buffers)
   */
  submitCommands(_commandBuffers: any[]): void {
    // WebGL2 doesn't use command buffers like WebGPU
    // Commands are executed immediately
  }

  /**
   * Initialize the textured quad rendering pipeline
   */
  private async initializeQuadPipeline(): Promise<void> {
    const gl = this.gl;

    try {
      // Get shader sources from the shader module
      this.logger.debug("Getting shader sources...", Color.fromHex("#888888"));
      const vertexShaderSource =
        TexturedQuadShaderWebGL2.getVertexShaderSource();
      const fragmentShaderSource =
        TexturedQuadShaderWebGL2.getFragmentShaderSource();

      // Create and compile shaders
      this.logger.debug("Compiling vertex shader...", Color.fromHex("#888888"));
      const vertexShader = this.createShader(
        gl.VERTEX_SHADER,
        vertexShaderSource
      );
      if (!vertexShader) {
        throw new Error("Failed to create vertex shader");
      }

      this.logger.debug(
        "Compiling fragment shader...",
        Color.fromHex("#888888")
      );
      const fragmentShader = this.createShader(
        gl.FRAGMENT_SHADER,
        fragmentShaderSource
      );
      if (!fragmentShader) {
        throw new Error("Failed to create fragment shader");
      }

      // Create and link program
      this.logger.debug("Creating shader program...", Color.fromHex("#888888"));
      this.quadProgram = gl.createProgram();
      if (!this.quadProgram) {
        throw new Error("Failed to create shader program");
      }

      gl.attachShader(this.quadProgram, vertexShader);
      gl.attachShader(this.quadProgram, fragmentShader);

      this.logger.debug("Linking shader program...", Color.fromHex("#888888"));
      gl.linkProgram(this.quadProgram);

      if (!gl.getProgramParameter(this.quadProgram, gl.LINK_STATUS)) {
        const error = gl.getProgramInfoLog(this.quadProgram);
        gl.deleteProgram(this.quadProgram);
        throw new Error(`Failed to link shader program: ${error}`);
      }

      // Clean up shaders
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      this.logger.debug("Setting up WebGL state...", Color.fromHex("#888888"));
      // CRITICAL: Set up WebGL state for 2D rendering with transparency
      // Enable alpha blending (equivalent to WebGPU's blend configuration)
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Disable depth testing for 2D rendering (sprites should render in draw order)
      gl.disable(gl.DEPTH_TEST);

      // Disable face culling for 2D quads
      gl.disable(gl.CULL_FACE);

      // Create dynamic vertex buffer for interleaved data
      this.logger.debug("Creating vertex buffer...", Color.fromHex("#888888"));
      this.quadVertexBuffer = gl.createBuffer();
      if (!this.quadVertexBuffer) {
        throw new Error("Failed to create vertex buffer");
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVertexBuffer);
      // Allocate buffer with dynamic usage for frequent updates
      gl.bufferData(
        gl.ARRAY_BUFFER,
        this.dynamicVertexBuffer.byteLength,
        gl.DYNAMIC_DRAW
      );

      // Create VAO
      this.logger.debug(
        "Creating vertex array object...",
        Color.fromHex("#888888")
      );
      this.quadVAO = gl.createVertexArray();
      if (!this.quadVAO) {
        throw new Error("Failed to create vertex array object");
      }

      gl.bindVertexArray(this.quadVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVertexBuffer);

      // Get vertex layout from shader
      const layout = TexturedQuadShaderWebGL2.getVertexBufferLayout();

      // Set up vertex attributes using the layout
      this.logger.debug(
        "Setting up vertex attributes...",
        Color.fromHex("#888888")
      );
      for (const attr of layout.attributes) {
        const location = gl.getAttribLocation(this.quadProgram, attr.name);
        if (location >= 0) {
          gl.enableVertexAttribArray(location);

          if (attr.type === gl.UNSIGNED_INT) {
            // Use integer attribute for uint32 color
            gl.vertexAttribIPointer(
              location,
              attr.size,
              attr.type,
              layout.stride,
              attr.offset
            );
          } else {
            // Use regular attribute for float data
            gl.vertexAttribPointer(
              location,
              attr.size,
              attr.type,
              attr.normalized,
              layout.stride,
              attr.offset
            );
          }
        } else {
          this.logger.warn(
            `Vertex attribute '${attr.name}' not found in shader`,
            Color.fromHex("#FFAA00")
          );
        }
      }

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      // Cache uniform locations for performance
      this.logger.debug(
        "Caching uniform locations...",
        Color.fromHex("#888888")
      );
      this.cachedUniformLocations = {
        mvpMatrix: gl.getUniformLocation(this.quadProgram, "u_mvpMatrix"),
        texture: gl.getUniformLocation(this.quadProgram, "u_texture"),
      };

      this.logger.debug(
        "WebGL2 quad pipeline initialized successfully",
        Color.fromHex("#888888")
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize WebGL2 quad pipeline: ${error}`,
        Color.fromHex("#FF4444")
      );
      throw error;
    }
  }

  private createShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;

    const shader = gl.createShader(type);
    if (!shader) {
      this.logger.error(
        "Failed to create shader object",
        Color.fromHex("#FF4444")
      );
      return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      const shaderType = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
      this.logger.error(
        `Failed to compile ${shaderType} shader: ${error}`,
        Color.fromHex("#FF4444")
      );
      this.logger.debug(`Shader source:\n${source}`, Color.fromHex("#888888"));
      gl.deleteShader(shader);
      throw new Error(`Failed to compile ${shaderType} shader: ${error}`);
    }

    return shader;
  }

  /**
   * Begin a new frame for rendering
   */
  beginFrame(clearColor?: Color, projectionMatrix?: Float32Array): void {
    if (this.frameInProgress) {
      throw new Error("Frame already in progress. Call endFrame() first.");
    }

    const gl = this.gl;

    // Use provided clear color or default
    const currentClearColor = clearColor || this.cachedClearColor;

    // Efficient color comparison using packed RGBA integer
    const clearColorChanged =
      currentClearColor.rgba !== this.cachedClearColor.rgba;

    // Update cached clear color and set GL clear color if changed
    if (clearColorChanged) {
      this.cachedClearColor = currentClearColor; // No need to clone flyweight colors
      gl.clearColor(
        this.cachedClearColor.r,
        this.cachedClearColor.g,
        this.cachedClearColor.b,
        this.cachedClearColor.a
      );
    }

    // Clear the canvas
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Set viewport only if size changed
    const canvasWidth = gl.canvas.width;
    const canvasHeight = gl.canvas.height;
    if (
      this.currentViewportWidth !== canvasWidth ||
      this.currentViewportHeight !== canvasHeight
    ) {
      gl.viewport(0, 0, canvasWidth, canvasHeight);
      this.currentViewportWidth = canvasWidth;
      this.currentViewportHeight = canvasHeight;
    }

    // Set up shader program and VAO once per frame
    if (this.quadProgram && this.quadProgram !== this.currentProgram) {
      gl.useProgram(this.quadProgram);
      this.currentProgram = this.quadProgram;
    }

    if (this.quadVAO && this.quadVAO !== this.currentVAO) {
      gl.bindVertexArray(this.quadVAO);
      this.currentVAO = this.quadVAO;
    }

    // Initialize batch state
    this.pendingQuads = [];

    // Store previous frame's peak values and reset current frame counters
    this.drawCallCount = this.frameDrawCallCount;
    this.batchCount = this.frameBatchCount;
    this.frameDrawCallCount = 0;
    this.frameBatchCount = 0;

    this.frameInProgress = true;

    // Check if projection matrix has changed
    const matrixToUse = projectionMatrix || this.cachedIdentityMatrix;
    let matrixChanged = false;

    if (!this.cachedProjectionMatrix) {
      this.cachedProjectionMatrix = new Float32Array(16);
      matrixChanged = true;
    } else {
      // Compare matrices efficiently
      matrixChanged = !Matrix.equals(this.cachedProjectionMatrix, matrixToUse);
    }

    // Update uniform only if matrix changed
    if (
      (matrixChanged || this.matrixNeedsUpdate) &&
      this.cachedUniformLocations?.mvpMatrix
    ) {
      Matrix.copy(matrixToUse, this.cachedProjectionMatrix);
      gl.uniformMatrix4fv(
        this.cachedUniformLocations.mvpMatrix,
        false,
        matrixToUse
      );
      this.matrixNeedsUpdate = false;
    }

    // Set texture uniform to use texture unit 0
    if (this.cachedUniformLocations?.texture) {
      gl.uniform1i(this.cachedUniformLocations.texture, 0);
    }
  }

  /**
   * Draw a textured quad with explicit corner coordinates (batched)
   */
  drawQuad(
    texture: WebGLTexture,
    sampler: WebGLSampler,
    vertices: Float32Array, // [ax, ay, bx, by, cx, cy, dx, dy] - 8 floats
    uvRegion: Float32Array, // [u1, v1, u2, v2] - 4 floats
    vertexColors: Uint32Array // [c1, c2, c3, c4] - 4 RGBA integers
  ): void {
    if (!this.frameInProgress) {
      throw new Error("No frame in progress. Call beginFrame() first.");
    }

    // Get a quad from the object pool instead of allocating
    const quad = this.quadPool[this.poolIndex];
    this.poolIndex = (this.poolIndex + 1) % WebGL2Graphics.QUAD_POOL_SIZE;

    // Set properties (reusing existing arrays in the pooled object)
    quad.texture = texture;
    quad.sampler = sampler;

    // Copy data to reused arrays (faster than allocation)
    quad.vertices.set(vertices);
    quad.uvRegion.set(uvRegion);
    quad.vertexColors.set(vertexColors);

    // Add to pending list for smart batching
    this.pendingQuads.push(quad);

    // Check if we need to flush due to batch size limit
    if (this.pendingQuads.length >= WebGL2Graphics.MAX_QUADS) {
      this.flushAllBatches();
    }
  }

  /**
   * Process all pending quads with smart texture sorting
   */
  private flushAllBatches(): void {
    if (this.pendingQuads.length === 0) {
      return;
    }

    // Optimized sorting: pre-compute sort keys to avoid function calls in comparator
    const quadCount = this.pendingQuads.length;

    // Ensure arrays are large enough (grow by doubling to avoid frequent reallocations)
    if (this.sortKeys.length < quadCount) {
      const newSize = Math.max(quadCount, this.sortKeys.length * 2);
      this.sortKeys = new Array(newSize);
      this.sortIndices = new Array(newSize);
      this.tempQuadsForSorting = new Array(newSize);
    }

    // Pre-compute sort keys (texture ID in high bits, sampler ID in low bits)
    for (let i = 0; i < quadCount; i++) {
      const quad = this.pendingQuads[i];
      const textureId = this.getTextureId(quad.texture);
      const samplerId = this.getSamplerId(quad.sampler);
      // Combine IDs into a single sortable key (texture ID in upper 16 bits, sampler in lower 16)
      this.sortKeys[i] = (textureId << 16) | (samplerId & 0xffff);
      this.sortIndices[i] = i;
    }

    // Sort only the used portion of indices (avoid slice allocation)
    // Temporarily store the original length and truncate for sorting
    const originalLength = this.sortIndices.length;
    this.sortIndices.length = quadCount;
    this.sortIndices.sort((a, b) => this.sortKeys[a] - this.sortKeys[b]);
    this.sortIndices.length = originalLength;

    // Reorder quads in-place using the sorted indices and pre-allocated temp array
    for (let i = 0; i < quadCount; i++) {
      this.tempQuadsForSorting[i] = this.pendingQuads[i];
    }
    for (let i = 0; i < quadCount; i++) {
      this.pendingQuads[i] = this.tempQuadsForSorting[this.sortIndices[i]];
    }

    // Process quads in batches by texture/sampler combination
    let currentBatchStart = 0;

    while (currentBatchStart < quadCount) {
      const currentTexture = this.pendingQuads[currentBatchStart].texture;
      const currentSampler = this.pendingQuads[currentBatchStart].sampler;

      // Find the end of this texture/sampler batch
      let currentBatchEnd = currentBatchStart;
      while (
        currentBatchEnd < quadCount &&
        this.pendingQuads[currentBatchEnd].texture === currentTexture &&
        this.pendingQuads[currentBatchEnd].sampler === currentSampler
      ) {
        currentBatchEnd++;
      }

      // Process this batch (avoid slice allocation by passing indices)
      this.processBatch(
        currentBatchStart,
        currentBatchEnd,
        currentTexture,
        currentSampler
      );
      this.frameBatchCount++;

      currentBatchStart = currentBatchEnd;
    }

    // Clear pending quads (reset length, don't reallocate)
    this.pendingQuads.length = 0;

    // Reset pool index for next frame
    this.poolIndex = 0;
  }

  /**
   * Process a single batch of quads with the same texture/sampler
   */
  private processBatch(
    startIndex: number,
    endIndex: number,
    texture: WebGLTexture,
    sampler: WebGLSampler
  ): void {
    const gl = this.gl;

    // Bind texture and sampler for this batch if different from current
    if (this.currentTexture !== texture) {
      if (this.currentActiveTexture !== 0) {
        gl.activeTexture(gl.TEXTURE0);
        this.currentActiveTexture = 0;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      this.currentTexture = texture;
    }

    if (this.currentSampler !== sampler) {
      gl.bindSampler(0, sampler);
      this.currentSampler = sampler;
    }

    // Set texture uniform if needed
    if (this.cachedUniformLocations?.texture) {
      gl.uniform1i(this.cachedUniformLocations.texture, 0);
    }

    // Process quads in chunks that fit in the vertex buffer
    const quadCount = endIndex - startIndex;
    for (let i = 0; i < quadCount; i += WebGL2Graphics.MAX_QUADS) {
      const chunkEnd = Math.min(i + WebGL2Graphics.MAX_QUADS, quadCount);
      const chunkSize = chunkEnd - i;

      // Fill vertex buffer with quad data
      for (let j = 0; j < chunkSize; j++) {
        const quad = this.pendingQuads[startIndex + i + j];
        const quadOffset = j * WebGL2Graphics.BYTES_PER_QUAD;

        this.writeQuadToBuffer(quad, quadOffset);
      }

      // Upload and draw this chunk
      this.uploadAndDrawChunk(chunkSize);
    }
  }

  /**
   * Write a single quad's data to the vertex buffer
   */
  private writeQuadToBuffer(quad: BatchedQuad, quadOffset: number): void {
    const { vertices, uvRegion, vertexColors } = quad;

    // Extract vertex coordinates
    const ax = vertices[0],
      ay = vertices[1]; // A: Top-left
    const bx = vertices[2],
      by = vertices[3]; // B: Top-right
    const cx = vertices[4],
      cy = vertices[5]; // C: Bottom-right
    const dx = vertices[6],
      dy = vertices[7]; // D: Bottom-left

    // Extract UV coordinates
    const u1 = uvRegion[0],
      v1 = uvRegion[1]; // Top-left UV
    const u2 = uvRegion[2],
      v2 = uvRegion[3]; // Bottom-right UV

    // Extract vertex colors
    const colorA = vertexColors[0]; // A: Top-left color
    const colorB = vertexColors[1]; // B: Top-right color
    const colorC = vertexColors[2]; // C: Bottom-right color
    const colorD = vertexColors[3]; // D: Bottom-left color

    // Helper function to write vertex data
    const writeVertex = (
      offset: number,
      x: number,
      y: number,
      u: number,
      v: number,
      color: number
    ) => {
      this.dynamicVertexView.setFloat32(offset, x, true);
      this.dynamicVertexView.setFloat32(offset + 4, y, true);
      this.dynamicVertexView.setFloat32(offset + 8, u, true);
      this.dynamicVertexView.setFloat32(offset + 12, v, true);
      this.dynamicVertexView.setUint32(offset + 16, color, true);
    };

    // Write vertex data for this quad
    // Triangle 1: A, B, C
    writeVertex(quadOffset + 0, ax, ay, u1, v1, colorA); // Vertex 0: A
    writeVertex(quadOffset + 20, bx, by, u2, v1, colorB); // Vertex 1: B
    writeVertex(quadOffset + 40, cx, cy, u2, v2, colorC); // Vertex 2: C

    // Triangle 2: A, C, D
    writeVertex(quadOffset + 60, ax, ay, u1, v1, colorA); // Vertex 3: A
    writeVertex(quadOffset + 80, cx, cy, u2, v2, colorC); // Vertex 4: C
    writeVertex(quadOffset + 100, dx, dy, u1, v2, colorD); // Vertex 5: D
  }

  /**
   * Upload vertex data and draw the current chunk
   */
  private uploadAndDrawChunk(quadCount: number): void {
    const gl = this.gl;

    // Upload vertex data
    const vertexDataSize = quadCount * WebGL2Graphics.BYTES_PER_QUAD;

    if (this.quadVertexBuffer !== this.currentBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVertexBuffer);
      this.currentBuffer = this.quadVertexBuffer;
    }

    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.dynamicVertexUint8,
      0,
      vertexDataSize
    );

    // Draw the chunk
    const numVertices = quadCount * 6; // 6 vertices per quad
    gl.drawArrays(gl.TRIANGLES, 0, numVertices);

    // Update statistics
    this.frameDrawCallCount++;
  }

  /**
   * End the current frame and submit commands
   */
  endFrame(): void {
    if (!this.frameInProgress) {
      throw new Error("No frame in progress. Call beginFrame() first.");
    }

    // Flush any remaining quads in the batch
    if (this.pendingQuads.length > 0) {
      this.flushAllBatches();
    }

    // Mark frame as complete
    this.frameInProgress = false;
  }

  /**
   * Clear a specific sampler from the cache
   * @param samplerKey The sampler cache key to remove
   */
  invalidateSampler(samplerKey: string): void {
    this.samplerCache.delete(samplerKey);
  }

  /**
   * Reset only the render state (useful when switching contexts)
   */
  resetRenderState(): void {
    this.currentProgram = null;
    this.currentVAO = null;
    this.currentBuffer = null;
    this.currentTexture = null;
    this.currentSampler = null;
    this.currentActiveTexture = -1;
    this.currentViewportWidth = -1;
    this.currentViewportHeight = -1;
  }

  /**
   * Clear all caches (should only be used during shutdown or major state changes)
   */
  clearCaches(): void {
    // Clean up WebGL sampler resources before clearing cache
    const gl = this.gl;
    for (const sampler of this.samplerCache.values()) {
      gl.deleteSampler(sampler);
    }
    this.samplerCache.clear();

    // Clear object ID maps (WeakMaps will auto-clean when objects are garbage collected)
    this.textureIdMap = new WeakMap();
    this.samplerIdMap = new WeakMap();
    this.nextTextureId = 1;
    this.nextSamplerId = 1;

    // Reset state tracking
    this.resetRenderState();

    // Reset matrix cache to force update on next frame
    this.cachedProjectionMatrix = null;
    this.matrixNeedsUpdate = true;
  }

  /**
   * Perform lightweight cache maintenance (removes only stale entries)
   */
  maintainCaches(): void {
    // WeakMaps automatically clean up when textures/samplers are GC'd
    // Only force matrix update if needed
    this.matrixNeedsUpdate = true;
  }

  /**
   * Force flush any pending batched operations
   */
  flush(): void {
    if (this.frameInProgress) {
      this.flushAllBatches();
    }
  }

  /**
   * Get or assign a consistent ID for a texture
   */
  private getTextureId(texture: WebGLTexture): number {
    let id = this.textureIdMap.get(texture);
    if (id === undefined) {
      id = this.nextTextureId++;
      this.textureIdMap.set(texture, id);
    }
    return id;
  }

  /**
   * Get or assign a consistent ID for a sampler
   */
  private getSamplerId(sampler: WebGLSampler): number {
    let id = this.samplerIdMap.get(sampler);
    if (id === undefined) {
      id = this.nextSamplerId++;
      this.samplerIdMap.set(sampler, id);
    }
    return id;
  }

  /**
   * Get comprehensive rendering statistics for debugging and performance monitoring
   */
  getRenderingStats(): RenderingStats {
    return {
      drawCallCount: this.drawCallCount,
      batchCount: this.batchCount,
      pendingQuads: this.pendingQuads.length,
      maxQuadsPerBatch: WebGL2Graphics.MAX_QUADS,
      vertexBufferUsage:
        (this.pendingQuads.length / WebGL2Graphics.MAX_QUADS) * 100,
      quadPoolUtilization:
        (this.poolIndex / WebGL2Graphics.QUAD_POOL_SIZE) * 100,
    };
  }
}
