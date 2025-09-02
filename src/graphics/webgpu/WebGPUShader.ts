// WebGPUShader.ts - WebGPU-specific shader implementation

import { IShader } from "../IShader";
import { WebGPUGraphics } from "./WebGPUGraphics";

export class WebGPUShader implements IShader {
  private _renderPipeline: GPURenderPipeline | null = null;
  private _shaderModule: GPUShaderModule | null = null;
  private _ready: boolean = false;
  private _shaderType: string = "unknown";
  private graphics: WebGPUGraphics;
  private _bindGroupLayout: GPUBindGroupLayout | null = null;
  private _uniformBuffer: GPUBuffer | null = null;
  private _bindGroup: GPUBindGroup | null = null;

  constructor() {
    this.graphics = WebGPUGraphics.getInstance();
  }

  get nativeShader(): GPURenderPipeline {
    if (!this._renderPipeline) {
      throw new Error("WebGPU shader is not ready");
    }
    return this._renderPipeline;
  }

  get isReady(): boolean {
    return this._ready;
  }

  get shaderType(): string {
    return this._shaderType;
  }

  async createFromSource(
    vertexSource: string,
    fragmentSource: string,
    shaderType: string = "custom"
  ): Promise<void> {
    if (this._ready) {
      return;
    }

    this._shaderType = shaderType;

    try {
      const device = this.graphics.device;
      const canvasFormat = this.graphics.canvasFormat;

      // Combine vertex and fragment shaders into a single WGSL shader
      const combinedShaderSource = `
        ${vertexSource}
        
        ${fragmentSource}
      `;

      // Create shader module
      this._shaderModule = device.createShaderModule({
        code: combinedShaderSource,
      });

      // Create bind group layout for uniforms
      this._bindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {
              type: "uniform" as GPUBufferBindingType,
            },
          },
        ],
      });

      // Create pipeline layout
      const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [this._bindGroupLayout],
      });

      // Create render pipeline
      this._renderPipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module: this._shaderModule,
          entryPoint: "vertexMain",
        },
        fragment: {
          module: this._shaderModule,
          entryPoint: "fragmentMain",
          targets: [{ format: canvasFormat }],
        },
        primitive: {
          topology: "triangle-list",
        },
      });

      // Create uniform buffer (256 bytes should be enough for most uniforms)
      this._uniformBuffer = device.createBuffer({
        size: 256,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Create bind group
      this._bindGroup = device.createBindGroup({
        layout: this._bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: {
              buffer: this._uniformBuffer,
            },
          },
        ],
      });

      this._ready = true;
    } catch (error) {
      throw new Error(`Failed to create WebGPU shader: ${error}`);
    }
  }

  bind(): void {
    if (!this._ready) {
      throw new Error("Shader is not ready");
    }
    // WebGPU binding is handled during render pass creation
    // This method is kept for API consistency
  }

  unbind(): void {
    // WebGPU doesn't have explicit unbinding like WebGL
    // This method is kept for API consistency
  }

  setUniform(_name: string, value: any): void {
    if (!this._uniformBuffer) {
      throw new Error("Uniform buffer not created");
    }

    // For simplicity, we'll write the value to the beginning of the buffer
    // In a real implementation, you'd want to track uniform offsets
    const device = this.graphics.device;

    if (typeof value === "number") {
      const data = new Float32Array([value]);
      device.queue.writeBuffer(this._uniformBuffer, 0, data);
    } else if (value instanceof Float32Array) {
      device.queue.writeBuffer(this._uniformBuffer, 0, value);
    } else if (Array.isArray(value)) {
      const data = new Float32Array(value);
      device.queue.writeBuffer(this._uniformBuffer, 0, data);
    }
  }

  setUniforms(uniforms: Record<string, any>): void {
    // For simplicity, we'll just set the first uniform
    // In a real implementation, you'd want to pack all uniforms into the buffer
    const keys = Object.keys(uniforms);
    if (keys.length > 0) {
      this.setUniform(keys[0], uniforms[keys[0]]);
    }
  }

  getUniformLocation(_name: string): number {
    // WebGPU doesn't use uniform locations like WebGL
    // Return a dummy value for API consistency
    return 0;
  }

  /**
   * Get the bind group for this shader (WebGPU specific)
   */
  get bindGroup(): GPUBindGroup | null {
    return this._bindGroup;
  }

  dispose(): void {
    if (this._uniformBuffer) {
      this._uniformBuffer.destroy();
      this._uniformBuffer = null;
    }

    // WebGPU objects don't have explicit dispose methods
    // The GPU will handle cleanup when objects are no longer referenced
    this._renderPipeline = null;
    this._shaderModule = null;
    this._bindGroupLayout = null;
    this._bindGroup = null;
    this._ready = false;
    this._shaderType = "unknown";
  }
}
