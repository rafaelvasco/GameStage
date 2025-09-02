// WebGL2Shader.ts - WebGL2-specific shader implementation

import { IShader } from "../IShader";
import { WebGL2Graphics } from "./WebGL2Graphics";

export class WebGL2Shader implements IShader {
  private _program: WebGLProgram | null = null;
  private _ready: boolean = false;
  private _shaderType: string = "unknown";
  private graphics: WebGL2Graphics;
  private _uniformLocations: Map<string, WebGLUniformLocation | null> =
    new Map();

  constructor() {
    this.graphics = WebGL2Graphics.getInstance();
  }

  get nativeShader(): WebGLProgram {
    if (!this._program) {
      throw new Error("WebGL2 shader is not ready");
    }
    return this._program;
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
      const gl = this.graphics.canvas.getContext(
        "webgl2"
      ) as WebGL2RenderingContext;
      if (!gl) {
        throw new Error("WebGL2 context not available");
      }

      // Create and compile vertex shader
      const vertexShader = this.createShader(
        gl,
        gl.VERTEX_SHADER,
        vertexSource
      );
      if (!vertexShader) {
        throw new Error("Failed to create vertex shader");
      }

      // Create and compile fragment shader
      const fragmentShader = this.createShader(
        gl,
        gl.FRAGMENT_SHADER,
        fragmentSource
      );
      if (!fragmentShader) {
        gl.deleteShader(vertexShader);
        throw new Error("Failed to create fragment shader");
      }

      // Create and link program
      this._program = gl.createProgram();
      if (!this._program) {
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error("Failed to create shader program");
      }

      gl.attachShader(this._program, vertexShader);
      gl.attachShader(this._program, fragmentShader);
      gl.linkProgram(this._program);

      // Check if linking was successful
      if (!gl.getProgramParameter(this._program, gl.LINK_STATUS)) {
        const error = gl.getProgramInfoLog(this._program);
        gl.deleteProgram(this._program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error(`Failed to link shader program: ${error}`);
      }

      // Clean up shaders (they're now part of the program)
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      this._ready = true;
    } catch (error) {
      throw new Error(`Failed to create WebGL2 shader: ${error}`);
    }
  }

  private createShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) {
      return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Failed to compile shader: ${error}`);
    }

    return shader;
  }

  bind(): void {
    if (!this._ready || !this._program) {
      throw new Error("Shader is not ready");
    }

    const gl = this.graphics.canvas.getContext(
      "webgl2"
    ) as WebGL2RenderingContext;
    if (gl) {
      gl.useProgram(this._program);
    }
  }

  unbind(): void {
    const gl = this.graphics.canvas.getContext(
      "webgl2"
    ) as WebGL2RenderingContext;
    if (gl) {
      gl.useProgram(null);
    }
  }

  setUniform(name: string, value: any): void {
    if (!this._ready || !this._program) {
      throw new Error("Shader is not ready");
    }

    const gl = this.graphics.canvas.getContext(
      "webgl2"
    ) as WebGL2RenderingContext;
    if (!gl) {
      return;
    }

    // Get or cache uniform location
    let location = this._uniformLocations.get(name);
    if (location === undefined) {
      location = gl.getUniformLocation(this._program, name);
      this._uniformLocations.set(name, location);
    }

    if (location === null) {
      console.warn(`Uniform '${name}' not found in shader`);
      return;
    }

    // Set uniform based on value type
    if (typeof value === "number") {
      gl.uniform1f(location, value);
    } else if (value instanceof Float32Array) {
      switch (value.length) {
        case 1:
          gl.uniform1f(location, value[0]);
          break;
        case 2:
          gl.uniform2fv(location, value);
          break;
        case 3:
          gl.uniform3fv(location, value);
          break;
        case 4:
          gl.uniform4fv(location, value);
          break;
        case 9:
          gl.uniformMatrix3fv(location, false, value);
          break;
        case 16:
          gl.uniformMatrix4fv(location, false, value);
          break;
        default:
          console.warn(`Unsupported uniform array length: ${value.length}`);
      }
    } else if (Array.isArray(value)) {
      const floatArray = new Float32Array(value);
      this.setUniform(name, floatArray);
    } else if (typeof value === "boolean") {
      gl.uniform1i(location, value ? 1 : 0);
    } else {
      console.warn(`Unsupported uniform type for '${name}':`, typeof value);
    }
  }

  setUniforms(uniforms: Record<string, any>): void {
    for (const [name, value] of Object.entries(uniforms)) {
      this.setUniform(name, value);
    }
  }

  getUniformLocation(name: string): WebGLUniformLocation | null {
    if (!this._ready || !this._program) {
      throw new Error("Shader is not ready");
    }

    // Check cache first
    if (this._uniformLocations.has(name)) {
      return this._uniformLocations.get(name) || null;
    }

    const gl = this.graphics.canvas.getContext(
      "webgl2"
    ) as WebGL2RenderingContext;
    if (!gl) {
      return null;
    }

    const location = gl.getUniformLocation(this._program, name);
    this._uniformLocations.set(name, location);
    return location;
  }

  dispose(): void {
    const gl = this.graphics.getGL();
    
    if (this._program && gl) {
      gl.deleteProgram(this._program);
      this._program = null;
    } else if (this._program) {
      // Context may be disposed already, but still clear reference
      this._program = null;
    }

    this._uniformLocations.clear();
    this._ready = false;
    this._shaderType = "unknown";
  }
}
