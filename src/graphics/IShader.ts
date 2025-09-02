// IShader.ts - Interface for backend-specific shader implementations

export interface IShader {
  /**
   * Get the native shader object (GPURenderPipeline for WebGPU, WebGLProgram for WebGL2)
   */
  get nativeShader(): any;

  /**
   * Check if shader is compiled/created
   */
  get isReady(): boolean;

  /**
   * Get shader type/name for debugging
   */
  get shaderType(): string;

  /**
   * Create shader from source code
   */
  createFromSource(
    vertexSource: string,
    fragmentSource: string,
    shaderType?: string
  ): Promise<void>;

  /**
   * Bind/use the shader for rendering
   */
  bind(): void;

  /**
   * Unbind the shader
   */
  unbind(): void;

  /**
   * Set uniform values (implementation varies by backend)
   */
  setUniform(name: string, value: any): void;

  /**
   * Set multiple uniforms at once
   */
  setUniforms(uniforms: Record<string, any>): void;

  /**
   * Get uniform location (for caching purposes)
   */
  getUniformLocation(name: string): any;

  /**
   * Dispose of the shader resources
   */
  dispose(): void;
}
