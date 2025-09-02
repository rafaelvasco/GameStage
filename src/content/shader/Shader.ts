// Shader.ts - Shader asset class

import { Asset } from "../Asset";
import { Graphics } from "../../graphics";
import { IShader } from "../../graphics";
import { logger } from "../../utils";

export class Shader extends Asset {
  private _backendShader: IShader | null = null;
  private _vertexSource: string = "";
  private _fragmentSource: string = "";
  private _shaderType: string = "custom";

  constructor(
    id: string,
    vertexPath: string,
    fragmentPath?: string,
    shaderType: string = "custom"
  ) {
    // If only one path is provided, assume it's a combined shader file
    super(id, vertexPath);
    this._shaderType = shaderType;

    // If fragmentPath is provided, store it separately
    if (fragmentPath) {
      this._fragmentPath = fragmentPath;
    }
  }

  private _fragmentPath?: string;

  get shader(): any {
    if (!this._backendShader) {
      throw new Error(`Shader '${this.id}' is not loaded`);
    }
    return this._backendShader.nativeShader;
  }

  get isLoaded(): boolean {
    return this._backendShader ? this._backendShader.isReady : false;
  }

  get shaderType(): string {
    return this._shaderType;
  }

  get vertexSource(): string {
    return this._vertexSource;
  }

  get fragmentSource(): string {
    return this._fragmentSource;
  }

  async load(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    try {
      const graphics = Graphics.getInstance();

      // Create the appropriate backend shader implementation
      this._backendShader = graphics.createShader();

      // Load shader source code
      if (this._fragmentPath) {
        // Load separate vertex and fragment files
        if (!this._filePath) {
          const errorMsg = `Vertex shader file path is required for shader '${this.id}'`;
          logger.error(errorMsg);
          throw new Error(errorMsg);
        }
        logger.debug(
          `Loading vertex shader from '${this._filePath}' for shader '${this.id}'`
        );
        this._vertexSource = await this.loadShaderFile(this._filePath);

        logger.debug(
          `Loading fragment shader from '${this._fragmentPath}' for shader '${this.id}'`
        );
        this._fragmentSource = await this.loadShaderFile(this._fragmentPath);
      } else {
        // Load combined shader file and split it
        if (!this._filePath) {
          const errorMsg = `Shader file path is required for shader '${this.id}'`;
          logger.error(errorMsg);
          throw new Error(errorMsg);
        }
        logger.debug(
          `Loading combined shader from '${this._filePath}' for shader '${this.id}'`
        );
        const combinedSource = await this.loadShaderFile(this._filePath);
        this.parseCombinedShader(combinedSource);
      }

      // Create the shader from source
      if (!this._backendShader) {
        const errorMsg = "Failed to create backend shader";
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      await this._backendShader.createFromSource(
        this._vertexSource,
        this._fragmentSource,
        this._shaderType
      );

      const pathInfo = this._fragmentPath
        ? `vertex: '${this._filePath}', fragment: '${this._fragmentPath}'`
        : `combined: '${this._filePath}'`;
      logger.debug(
        `Shader '${this.id}' loaded successfully from ${pathInfo} using ${graphics.backendType}`
      );
    } catch (error) {
      const pathInfo = this._fragmentPath
        ? `vertex: '${this._filePath}', fragment: '${this._fragmentPath}'`
        : `combined: '${this._filePath}'`;
      logger.error(
        `Failed to load Shader '${this.id}' from ${pathInfo}: ${error}`
      );
      throw new Error(
        `Failed to load Shader '${this.id}' from ${pathInfo}: ${error}`
      );
    }
  }

  private async loadShaderFile(path: string): Promise<string> {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        const errorMsg = `HTTP ${response.status} ${response.statusText} when loading shader file: ${path}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }
      return response.text();
    } catch (error) {
      logger.error(`Failed to load shader file from path '${path}': ${error}`);
      throw error;
    }
  }

  private parseCombinedShader(source: string): void {
    // Look for #vertex and #fragment markers
    const vertexMatch = source.match(/#vertex\s+([\s\S]*?)(?=#fragment|$)/);
    const fragmentMatch = source.match(/#fragment\s+([\s\S]*?)$/);

    if (vertexMatch) {
      this._vertexSource = vertexMatch[1].trim();
    } else {
      throw new Error("No #vertex section found in combined shader");
    }

    if (fragmentMatch) {
      this._fragmentSource = fragmentMatch[1].trim();
    } else {
      throw new Error("No #fragment section found in combined shader");
    }
  }

  dispose(): void {
    if (this._backendShader) {
      this._backendShader.dispose();
      this._backendShader = null;
    }

    this._vertexSource = "";
    this._fragmentSource = "";

    logger.debug(`Shader '${this.id}' disposed`);
  }

  /**
   * Bind the shader for rendering
   */
  bind(): void {
    if (!this._backendShader) {
      throw new Error(`Shader '${this.id}' is not loaded`);
    }
    this._backendShader.bind();
  }

  /**
   * Unbind the shader
   */
  unbind(): void {
    if (!this._backendShader) {
      throw new Error(`Shader '${this.id}' is not loaded`);
    }
    this._backendShader.unbind();
  }

  /**
   * Set a uniform value
   */
  setUniform(name: string, value: any): void {
    if (!this._backendShader) {
      throw new Error(`Shader '${this.id}' is not loaded`);
    }
    this._backendShader.setUniform(name, value);
  }

  /**
   * Set multiple uniform values
   */
  setUniforms(uniforms: Record<string, any>): void {
    if (!this._backendShader) {
      throw new Error(`Shader '${this.id}' is not loaded`);
    }
    this._backendShader.setUniforms(uniforms);
  }

  /**
   * Get uniform location (for caching purposes)
   */
  getUniformLocation(name: string): any {
    if (!this._backendShader) {
      throw new Error(`Shader '${this.id}' is not loaded`);
    }
    return this._backendShader.getUniformLocation(name);
  }

  /**
   * Gets the backend-specific shader implementation
   */
  get backendShader(): IShader {
    if (!this._backendShader) {
      throw new Error(`Shader '${this.id}' is not loaded`);
    }
    return this._backendShader;
  }
}
