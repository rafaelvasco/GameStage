import { Scene } from "./Scene";
import { Canvas } from "../graphics/Canvas";
import { Content } from "../content/Content";
import { Texture2D } from "../content/image/Texture2D";
import { Color } from "../graphics/Color";
import { logger } from "../utils";

export class DefaultTextureTestScene extends Scene {
  private defaultTexture: Texture2D | null = null;
  private initialized: boolean = false;
  private textureSize: number = 512;

  constructor(canvas: Canvas, content: Content) {
    super(canvas, content);
  }

  async initialize(): Promise<boolean> {
    logger.info("Initializing DefaultTextureTestScene...");

    try {
      // Get the default texture
      this.defaultTexture = await this.content.getDefaultTexture();

      logger.info(
        `Default texture loaded: ${this.defaultTexture.width}x${this.defaultTexture.height}`
      );

      this.initialized = true;
      return true;
    } catch (error) {
      logger.error(`Failed to initialize DefaultTextureTestScene: ${error}`);
      return false;
    }
  }

  update(_deltaTime: number): void {
    // No updates needed for this simple test
  }

  fixedUpdate(_deltaTime: number): void {
    // No fixed updates needed
  }

  draw(_interpolationFactor: number): void {
    if (!this.initialized || !this.defaultTexture) {
      return;
    }

    // Draw the default texture in the center of the screen
    const centerX = this.canvas.width / 2 - this.textureSize / 2;
    const centerY = this.canvas.height / 2 - this.textureSize / 2;

    this.canvas.drawQuadEx(
      this.defaultTexture,
      centerX,
      centerY,
      Color.WHITE,
      this.textureSize,
      this.textureSize
    );

    // Draw labels using the canvas text methods
    this.canvas.drawText("Default Engine Logo Texture", 10, 10, Color.WHITE);

    this.canvas.drawText(
      `Size: ${this.defaultTexture.width}x${this.defaultTexture.height}`,
      10,
      30,
      Color.WHITE
    );
  }

  cleanup(): void {
    // The default texture is managed by Content, no cleanup needed
    this.defaultTexture = null;
    this.initialized = false;
    logger.info("DefaultTextureTestScene cleaned up");
  }
}
