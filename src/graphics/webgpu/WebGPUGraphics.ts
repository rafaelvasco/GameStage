// WebGPUGraphics.ts - WebGPU implementation of the graphics context interface

/// <reference path="./webgpu.d.ts" />

import { IGraphicsContext, RenderingStats } from "../IGraphicsContext";
import { Color } from "../Color";
import {
  TEXTURED_QUAD_SHADER_WGSL,
  QUAD_UNIFORM_BUFFER_SIZE,
} from "./TexturedQuadShaderWebGPU";
import { Logger, Matrix } from "../../utils";
import { toast } from "../../utils/Toast";

interface GPUContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  canvasFormat: GPUTextureFormat;
  canvas: HTMLCanvasElement;
}

interface BatchedQuad {
  texture: GPUTexture;
  sampler: GPUSampler;
  vertices: Float32Array; // [ax, ay, bx, by, cx, cy, dx, dy] - 8 floats
  uvRegion: Float32Array; // [u1, v1, u2, v2] - 4 floats
  vertexColors: Uint32Array; // [c1, c2, c3, c4] - 4 RGBA integers
}

export class WebGPUGraphics implements IGraphicsContext {
  private static instance: WebGPUGraphics | null = null;
  private gpuContext: GPUContext | null = null;
  private initialized: boolean = false;
  private logger: Logger;
  private quadPipeline: GPURenderPipeline | null = null;
  private quadVertexBuffer: GPUBuffer | null = null;
  private quadUniformBuffer: GPUBuffer | null = null;
  private quadBindGroupLayout: GPUBindGroupLayout | null = null;

  // Frame management for efficient rendering
  private currentCommandEncoder: GPUCommandEncoder | null = null;
  private currentRenderPass: GPURenderPassEncoder | null = null;
  private frameInProgress: boolean = false;

  // Rendering statistics tracking
  private drawCallCount: number = 0;
  private batchCount: number = 0;
  private frameDrawCallCount: number = 0; // Current frame's draw calls
  private frameBatchCount: number = 0; // Current frame's batches

  // Cached objects for performance optimization
  private cachedUniformData: Float32Array = new Float32Array(16); // Just 16 floats for matrix
  private cachedRenderPassDescriptor: GPURenderPassDescriptor | null = null;
  private bindGroupWeakCache: WeakMap<
    GPUTexture,
    Map<GPUSampler, GPUBindGroup>
  > = new WeakMap();
  private textureViewCache: WeakMap<GPUTexture, GPUTextureView> = new WeakMap();
  private samplerCache: Map<string, GPUSampler> = new Map();
  private static readonly MAX_SAMPLER_CACHE_SIZE = 64; // Reasonable limit for sampler combinations

  // Cached identity matrix for performance
  private cachedIdentityMatrix: Float32Array = Matrix.createIdentity();

  // Batched quad rendering system
  private static readonly MAX_QUADS_PER_BATCH = 1024; // Limit per texture batch
  private static readonly MAX_QUADS_PER_FRAME = 4096; // Total frame capacity
  private static readonly VERTICES_PER_QUAD = 6;
  private static readonly BYTES_PER_VERTEX = 20; // position(8) + texCoord(8) + color(4)
  private static readonly BYTES_PER_QUAD =
    WebGPUGraphics.VERTICES_PER_QUAD * WebGPUGraphics.BYTES_PER_VERTEX;

  // Single vertex buffer sized for frame capacity (WebGPU handles concurrency via queue.writeBuffer)
  private dynamicVertexBuffer: ArrayBuffer = new ArrayBuffer(
    WebGPUGraphics.MAX_QUADS_PER_FRAME * WebGPUGraphics.BYTES_PER_QUAD
  );
  private dynamicVertexView: DataView = new DataView(this.dynamicVertexBuffer);

  // Enhanced batch state for smart texture sorting (per-frame allocation)
  private pendingQuads: BatchedQuad[] = [];

  // Pre-computed sort keys for faster sorting (avoids function calls in sort comparator)
  private sortKeys: number[] = new Array(WebGPUGraphics.MAX_QUADS_PER_FRAME);
  private sortIndices: number[] = new Array(WebGPUGraphics.MAX_QUADS_PER_FRAME);

  // Pre-allocated temporary array for sorting to avoid repeated slice allocations
  private tempQuadsForSorting: BatchedQuad[] = new Array(
    WebGPUGraphics.MAX_QUADS_PER_FRAME
  );

  // Object pool for BatchedQuad objects to avoid allocations
  private quadPool: BatchedQuad[] = [];
  private poolIndex: number = 0;
  private static readonly QUAD_POOL_SIZE = 8192; // Double the max quads for safety

  // Object ID tracking for consistent sorting
  private textureIdMap: WeakMap<GPUTexture, number> = new WeakMap();
  private samplerIdMap: WeakMap<GPUSampler, number> = new WeakMap();
  private nextTextureId: number = 1;
  private nextSamplerId: number = 1;

  // State tracking to avoid redundant GPU operations
  private currentPipeline: GPURenderPipeline | null = null;
  private cachedProjectionMatrix: Float32Array | null = null;
  private matrixNeedsUpdate: boolean = true;

  // Clear color caching
  private cachedClearColor: Color = Color.BLACK;

  private constructor() {
    this.logger = Logger.getInstance();

    // Initialize quad object pool
    this.initializeQuadPool();

    // Single buffer initialization handled in field declaration
  }

  /**
   * Initialize the object pool for BatchedQuad objects
   */
  private initializeQuadPool(): void {
    this.quadPool = new Array(WebGPUGraphics.QUAD_POOL_SIZE);
    for (let i = 0; i < WebGPUGraphics.QUAD_POOL_SIZE; i++) {
      this.quadPool[i] = {
        texture: null!,  // Will be assigned before use
        sampler: null!,  // Will be assigned before use
        vertices: new Float32Array(8),
        uvRegion: new Float32Array(4),
        vertexColors: new Uint32Array(4),
      };
    }
  }


  static getInstance(): WebGPUGraphics {
    if (!WebGPUGraphics.instance) {
      WebGPUGraphics.instance = new WebGPUGraphics();
    }
    return WebGPUGraphics.instance;
  }

  /**
   * Reset the WebGPUGraphics singleton instance (useful for testing)
   */
  static resetInstance(): void {
    if (WebGPUGraphics.instance) {
      // Clean up any resources if needed
      WebGPUGraphics.instance.clearCaches();
      WebGPUGraphics.instance = null;
    }
  }

  /**
   * Initialize the graphics system with WebGPU
   */
  async initialize(canvasId: string): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      this.logger.error(
        `Canvas element with id '${canvasId}' not found`,
        Color.fromHex("#FF4444")
      );
      return false;
    }

    // Check if WebGPU is supported
    if (!navigator.gpu) {
      toast.error(
        "WebGPU is not supported in your browser. Try using Chrome, Edge, or Firefox with WebGPU enabled.",
        {
          title: "WebGPU Not Supported",
          icon: "⚡",
        }
      );
      return false;
    }

    // Request adapter
    this.logger.debug("Requesting WebGPU adapter...", Color.fromHex("#888888"));
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      toast.error(
        "Failed to get GPU adapter. Your graphics hardware may not support WebGPU.",
        {
          title: "GPU Adapter Failed",
          icon: "🔧",
        }
      );
      return false;
    }

    // Log adapter info
    this.logger.info(
      "WebGPU adapter obtained successfully",
      Color.fromHex("#00AAFF")
    );

    // Request device
    this.logger.debug("Requesting WebGPU device...", Color.fromHex("#888888"));
    const device = await adapter.requestDevice();

    this.logger.info(
      "WebGPU device created successfully",
      Color.fromHex("#00AAFF")
    );

    // Configure the canvas
    const context = canvas.getContext("webgpu") as GPUCanvasContext;
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

    this.logger.debug(
      `Configuring WebGPU canvas context with format: ${canvasFormat}`,
      Color.fromHex("#888888")
    );

    context.configure({
      device: device,
      format: canvasFormat,
      alphaMode: "premultiplied",
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.gpuContext = {
      device,
      context,
      canvasFormat,
      canvas,
    };

    // Create quad pipeline and buffers
    this.logger.debug(
      "Initializing WebGPU quad pipeline...",
      Color.fromHex("#888888")
    );
    await this.initializeQuadPipeline();

    this.initialized = true;
    return true;
  }

  private getGPUContext(): GPUContext {
    if (!this.gpuContext) {
      throw new Error("Graphics system not initialized");
    }
    return this.gpuContext;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get device(): GPUDevice {
    return this.getGPUContext().device;
  }

  private get context(): GPUCanvasContext {
    return this.getGPUContext().context;
  }

  get canvasFormat(): GPUTextureFormat {
    return this.getGPUContext().canvasFormat;
  }

  get canvas(): HTMLCanvasElement {
    return this.getGPUContext().canvas;
  }

  /**
   * Creates a texture from image data
   */
  createTextureFromImageData(
    imageData: ImageData | HTMLImageElement | ImageBitmap,
    usage: number = GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT
  ): GPUTexture {
    const device = this.device;

    let width: number;
    let height: number;

    if (imageData instanceof ImageData) {
      width = imageData.width;
      height = imageData.height;
    } else if (imageData instanceof HTMLImageElement) {
      width = imageData.naturalWidth;
      height = imageData.naturalHeight;
    } else {
      width = imageData.width;
      height = imageData.height;
    }

    const texture = device.createTexture({
      size: { width, height },
      format: "rgba8unorm",
      usage,
    });

    device.queue.copyExternalImageToTexture(
      { source: imageData },
      { texture },
      { width, height }
    );

    return texture;
  }

  /**
   * Creates a sampler with common settings (cached)
   */
  createSampler(
    magFilter: GPUFilterMode = "nearest",
    minFilter: GPUFilterMode = "nearest",
    addressModeU: GPUAddressMode = "clamp-to-edge",
    addressModeV: GPUAddressMode = "clamp-to-edge"
  ): GPUSampler {
    const cacheKey = `${magFilter}_${minFilter}_${addressModeU}_${addressModeV}`;

    let sampler = this.samplerCache.get(cacheKey);
    if (!sampler) {
      // Check if cache is at capacity and needs cleanup
      if (this.samplerCache.size >= WebGPUGraphics.MAX_SAMPLER_CACHE_SIZE) {
        // Remove oldest entry (first in Map iteration order)
        const firstKey = this.samplerCache.keys().next().value;
        if (firstKey) {
          this.samplerCache.delete(firstKey);
        }
      }

      sampler = this.device.createSampler({
        magFilter,
        minFilter,
        addressModeU,
        addressModeV,
      });
      this.samplerCache.set(cacheKey, sampler);
    }

    return sampler;
  }

  /**
   * Loads an image from a URL
   */
  /**
   * Creates a command encoder
   */
  createCommandEncoder(label?: string): GPUCommandEncoder {
    return this.device.createCommandEncoder({ label });
  }

  /**
   * Submits command buffers to the queue
   */
  submitCommands(commandBuffers: GPUCommandBuffer[]): void {
    this.device.queue.submit(commandBuffers);
  }

  /**
   * Initialize the textured quad rendering pipeline
   */
  private async initializeQuadPipeline(): Promise<void> {
    const device = this.device;
    const canvasFormat = this.canvasFormat;

    // Create single GPU vertex buffer
    this.quadVertexBuffer = device.createBuffer({
      size: this.dynamicVertexBuffer.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Create uniform buffer
    this.quadUniformBuffer = device.createBuffer({
      size: QUAD_UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create bind group layout
    this.quadBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
      ],
    });

    // Create shader module
    const shaderModule = device.createShaderModule({
      code: TEXTURED_QUAD_SHADER_WGSL,
    });

    // Create pipeline layout
    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.quadBindGroupLayout],
    });

    // Create render pipeline
    this.quadPipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
        buffers: [
          {
            arrayStride: 5 * 4, // 5 values per vertex (x, y, u, v as floats, color as u32)
            attributes: [
              { format: "float32x2", offset: 0, shaderLocation: 0 }, // position
              { format: "float32x2", offset: 8, shaderLocation: 1 }, // texCoord
              { format: "uint32", offset: 16, shaderLocation: 2 }, // color
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: canvasFormat,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
      multisample: {
        count: 1,
      },
    });
  }

  /**
   * Begin a new frame for rendering
   */
  beginFrame(clearColor?: Color, projectionMatrix?: Float32Array): void {
    if (this.frameInProgress) {
      throw new Error("Frame already in progress. Call endFrame() first.");
    }

    const device = this.device;

    // Create command encoder for this frame
    this.currentCommandEncoder = device.createCommandEncoder();

    // Use provided clear color or default
    const currentClearColor = clearColor || this.cachedClearColor;

    // Efficient color comparison using packed RGBA integer
    const clearColorChanged =
      currentClearColor.rgba !== this.cachedClearColor.rgba;

    // Update cached clear color if changed
    if (clearColorChanged) {
      this.cachedClearColor = currentClearColor;
    }

    // Get current canvas texture
    const canvasTexture = this.context.getCurrentTexture();

    // Create or reuse render pass descriptor
    if (!this.cachedRenderPassDescriptor || clearColorChanged) {
      this.cachedRenderPassDescriptor = {
        colorAttachments: [
          {
            view: canvasTexture.createView(),
            clearValue: {
              r: this.cachedClearColor.r,
              g: this.cachedClearColor.g,
              b: this.cachedClearColor.b,
              a: this.cachedClearColor.a,
            },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      };
    } else {
      // Update the texture view for current frame
      this.cachedRenderPassDescriptor.colorAttachments![0]!.view =
        canvasTexture.createView();
    }

    // Create render pass
    this.currentRenderPass = this.currentCommandEncoder.beginRenderPass(
      this.cachedRenderPassDescriptor
    );

    // Set pipeline once per frame
    if (this.quadPipeline && this.quadPipeline !== this.currentPipeline) {
      this.currentRenderPass.setPipeline(this.quadPipeline);
      this.currentPipeline = this.quadPipeline;
    }

    // Initialize batch state
    this.pendingQuads = [];

    // Store previous frame's peak values and reset current frame counters
    this.drawCallCount = this.frameDrawCallCount;
    this.batchCount = this.frameBatchCount;
    this.frameDrawCallCount = 0;
    this.frameBatchCount = 0;

    this.frameInProgress = true;

    // Bind single vertex buffer once per frame
    if (this.quadVertexBuffer) {
      this.currentRenderPass.setVertexBuffer(0, this.quadVertexBuffer);
    }

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

    // Update uniform buffer only if matrix changed
    if (matrixChanged || this.matrixNeedsUpdate) {
      Matrix.copy(matrixToUse, this.cachedProjectionMatrix);
      this.cachedUniformData.set(matrixToUse, 0);
      device.queue.writeBuffer(
        this.quadUniformBuffer!,
        0,
        this.cachedUniformData.buffer,
        0,
        QUAD_UNIFORM_BUFFER_SIZE
      );
      this.matrixNeedsUpdate = false;
    }
  }

  /**
   * Draw a textured quad with explicit corner coordinates (batched)
   */
  drawQuad(
    texture: any,
    sampler: any,
    vertices: Float32Array, // [ax, ay, bx, by, cx, cy, dx, dy] - 8 floats
    uvRegion: Float32Array, // [u1, v1, u2, v2] - 4 floats
    vertexColors: Uint32Array // [c1, c2, c3, c4] - 4 RGBA integers
  ): void {
    if (!this.frameInProgress || !this.currentRenderPass) {
      throw new Error("No frame in progress. Call beginFrame() first.");
    }

    // Validate input parameters
    if (!texture || !sampler) {
      this.logger.error("Invalid texture or sampler in drawQuad");
      return;
    }

    if (
      vertices.length !== 8 ||
      uvRegion.length !== 4 ||
      vertexColors.length !== 4
    ) {
      this.logger.error(
        `Invalid array sizes in drawQuad: vertices=${vertices.length}, uvRegion=${uvRegion.length}, vertexColors=${vertexColors.length}`
      );
      return;
    }

    // Get a quad from the object pool instead of allocating
    const quad = this.quadPool[this.poolIndex];
    this.poolIndex = (this.poolIndex + 1) % WebGPUGraphics.QUAD_POOL_SIZE;

    // Set properties (reusing existing arrays in the pooled object)
    quad.texture = texture;
    quad.sampler = sampler;

    // Copy data to reused arrays (faster than allocation)
    quad.vertices.set(vertices);
    quad.uvRegion.set(uvRegion);
    quad.vertexColors.set(vertexColors);

    // Add to pending list for smart batching
    this.pendingQuads.push(quad);

    // Check if we need to flush due to frame capacity limit
    if (this.pendingQuads.length >= WebGPUGraphics.MAX_QUADS_PER_FRAME) {
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

    const totalQuadCount = this.pendingQuads.length;

    // Pre-compute sort keys for texture batching
    for (let i = 0; i < totalQuadCount; i++) {
      const quad = this.pendingQuads[i];
      const textureId = this.getTextureId(quad.texture);
      const samplerId = this.getSamplerId(quad.sampler);
      this.sortKeys[i] = (textureId << 16) | (samplerId & 0xffff);
      this.sortIndices[i] = i;
    }

    // Sort indices based on texture/sampler
    const originalLength = this.sortIndices.length;
    this.sortIndices.length = totalQuadCount;
    this.sortIndices.sort((a, b) => this.sortKeys[a] - this.sortKeys[b]);
    this.sortIndices.length = originalLength;

    // Reorder quads using sorted indices
    for (let i = 0; i < totalQuadCount; i++) {
      this.tempQuadsForSorting[i] = this.pendingQuads[i];
    }
    for (let i = 0; i < totalQuadCount; i++) {
      this.pendingQuads[i] = this.tempQuadsForSorting[this.sortIndices[i]];
    }

    // STEP 1: Write ALL quads to buffer sequentially (no chunking!)
    for (let i = 0; i < totalQuadCount; i++) {
      const quad = this.pendingQuads[i];
      const quadOffset = i * WebGPUGraphics.BYTES_PER_QUAD;
      this.writeQuadToBuffer(quad, quadOffset);
    }

    // STEP 2: Single upload for entire frame (the key fix!)
    const totalVertexDataSize = totalQuadCount * WebGPUGraphics.BYTES_PER_QUAD;
    this.device.queue.writeBuffer(
      this.quadVertexBuffer!,
      0,
      this.dynamicVertexBuffer,
      0,
      totalVertexDataSize
    );

    // STEP 3: Draw in texture/sampler batches using vertex ranges
    let currentBatchStart = 0;
    while (currentBatchStart < totalQuadCount) {
      const currentTexture = this.pendingQuads[currentBatchStart].texture;
      const currentSampler = this.pendingQuads[currentBatchStart].sampler;

      // Find the end of this texture/sampler batch
      let currentBatchEnd = currentBatchStart;
      while (
        currentBatchEnd < totalQuadCount &&
        this.pendingQuads[currentBatchEnd].texture === currentTexture &&
        this.pendingQuads[currentBatchEnd].sampler === currentSampler
      ) {
        currentBatchEnd++;
      }

      // Draw this batch with correct vertex range
      this.drawBatch(
        currentBatchStart,
        currentBatchEnd,
        currentTexture,
        currentSampler
      );
      
      this.frameBatchCount++;
      currentBatchStart = currentBatchEnd;
    }

    // Clear pending quads
    this.pendingQuads.length = 0;

    // Reset pool index for next frame
    this.poolIndex = 0;
  }

  /**
   * Draw a batch of quads with the same texture/sampler (fixed approach)
   */
  private drawBatch(
    startIndex: number,
    endIndex: number,
    texture: GPUTexture,
    sampler: GPUSampler
  ): void {
    if (!this.currentRenderPass) return;

    // Set bind group for this texture/sampler combination
    const bindGroup = this.getCachedBindGroup(texture, sampler);
    this.currentRenderPass.setBindGroup(0, bindGroup);

    // Calculate vertex range for this batch
    const quadCount = endIndex - startIndex;
    const startVertex = startIndex * WebGPUGraphics.VERTICES_PER_QUAD;
    const vertexCount = quadCount * WebGPUGraphics.VERTICES_PER_QUAD;

    // Draw this batch (data already uploaded to buffer)
    this.currentRenderPass.draw(vertexCount, 1, startVertex, 0);

    // Update statistics
    this.frameDrawCallCount++;
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

    // Use single vertex buffer view

    // Helper function to write vertex data to single buffer
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
   * End the current frame and submit commands
   */
  endFrame(): void {
    if (!this.frameInProgress) {
      throw new Error("No frame in progress. Call beginFrame() first.");
    }

    // Flush any remaining quads in the batch
    this.flushAllBatches();

    // Only end render pass and submit if they haven't been ended already by micro-submissions
    if (this.currentRenderPass && this.currentCommandEncoder) {
      this.currentRenderPass.end();
      this.device.queue.submit([this.currentCommandEncoder.finish()]);
    }

    this.currentCommandEncoder = null;
    this.currentRenderPass = null;
    this.frameInProgress = false;

    // Reset state tracking for next frame
    this.currentPipeline = null;

    // Reset pool index for next frame
    this.poolIndex = 0;
  }

  /**
   * Get or create a cached texture view
   */
  private getCachedTextureView(texture: GPUTexture): GPUTextureView {
    let view = this.textureViewCache.get(texture);
    if (!view) {
      view = texture.createView();
      this.textureViewCache.set(texture, view);
    }
    return view;
  }

  /**
   * Get or create a cached bind group (optimized with WeakMap)
   */
  private getCachedBindGroup(
    texture: GPUTexture,
    sampler: GPUSampler
  ): GPUBindGroup {
    // Use WeakMap for efficient caching without string operations
    let samplerMap = this.bindGroupWeakCache.get(texture);
    if (!samplerMap) {
      samplerMap = new Map();
      this.bindGroupWeakCache.set(texture, samplerMap);
    }

    let bindGroup = samplerMap.get(sampler);
    if (!bindGroup) {
      bindGroup = this.device.createBindGroup({
        layout: this.quadBindGroupLayout!,
        entries: [
          { binding: 0, resource: { buffer: this.quadUniformBuffer! } },
          { binding: 1, resource: this.getCachedTextureView(texture) },
          { binding: 2, resource: sampler },
        ],
      });
      samplerMap.set(sampler, bindGroup);
    }
    return bindGroup;
  }

  /**
   * Clear only bind groups associated with a specific texture
   * @param texture The texture whose bind groups should be invalidated
   */
  invalidateTextureBindGroups(texture: GPUTexture): void {
    this.bindGroupWeakCache.delete(texture);
  }

  /**
   * Clear only the texture view for a specific texture
   * @param texture The texture whose view should be invalidated
   */
  invalidateTextureView(texture: GPUTexture): void {
    this.textureViewCache.delete(texture);
  }

  /**
   * Clear a specific sampler from the cache
   * @param samplerKey The sampler cache key to remove
   */
  invalidateSampler(samplerKey: string): void {
    this.samplerCache.delete(samplerKey);
  }

  /**
   * Clear all caches (should only be used during shutdown or major state changes)
   */
  clearCaches(): void {
    this.bindGroupWeakCache = new WeakMap();
    this.textureViewCache = new WeakMap();
    this.samplerCache.clear();

    // Clear object ID maps (WeakMaps will auto-clean when objects are garbage collected)
    this.textureIdMap = new WeakMap();
    this.samplerIdMap = new WeakMap();
    this.nextTextureId = 1;
    this.nextSamplerId = 1;

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
  private getTextureId(texture: GPUTexture): number {
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
  private getSamplerId(sampler: GPUSampler): number {
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
      maxQuadsPerBatch: WebGPUGraphics.MAX_QUADS_PER_BATCH,
      vertexBufferUsage:
        (this.pendingQuads.length / WebGPUGraphics.MAX_QUADS_PER_FRAME) * 100,
      quadPoolUtilization:
        (this.poolIndex / WebGPUGraphics.QUAD_POOL_SIZE) * 100,
    };
  }
}
