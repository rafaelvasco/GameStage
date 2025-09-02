import { Scene } from "./Scene";
import { Canvas } from "../graphics/Canvas";
import { Content } from "../content/Content";
import { Texture2D } from "../content/image/Texture2D";
import { LoadingProgress } from "../content";
import { Color } from "../graphics/Color";
import { logger } from "../utils";
import { TextureRegion } from "../graphics";
import { Bitmap, Blitter } from "../graphics";

export class SpriteTestScene extends Scene {
  private testTexture: Texture2D | null = null;
  private runtimeTexture: Texture2D | null = null;

  // Loading state
  private showLoadingScreen: boolean = true;
  private criticalAssetsLoaded: boolean = false;

  // Animation state
  private time: number = 0;
  private rotation: number = 0;

  // Stats logging
  private lastStatsLogTime: number = 0;
  private readonly STATS_LOG_INTERVAL: number = 5000; // Log stats every 5 seconds

  constructor(canvas: Canvas, content: Content) {
    super(canvas, content);
  }

  async initialize(): Promise<boolean> {
    logger.info("Initializing SpriteTestScene...");

    const bitmap = Bitmap.create(128, 128);
    const redColor = Bitmap.rgba(255, 0, 0, 255);
    const blitter = Blitter.getInstance();
    blitter.setTarget(bitmap);
    blitter.fill(redColor);
    this.runtimeTexture = await this.content.createTexture2D(
      "white_texture",
      bitmap.imageData
    );

    try {
      // Load all preload bundles
      const preloadLoaded = await this.content.loadBundle(
        "sprite-test",
        (progress) => this.onLoadingProgress(progress)
      );

      if (!preloadLoaded) {
        logger.error("Failed to load preload assets for SpriteTestScene");
        return false;
      }

      // Get the texture
      this.testTexture = this.content.get<Texture2D>("guitar");
      if (!this.testTexture) {
        logger.error("Failed to get guitar guy texture after loading");
        return false;
      }

      // Demonstrate the improved Texture2D API - easy to change filtering and address modes!
      // No need to call createCustomSampler or manage internal details
      this.testTexture.magFilter = "nearest"; // Pixelated look
      this.testTexture.minFilter = "nearest";
      this.testTexture.setAddressMode("repeat"); // Set both U and V to repeat

      // Or set them individually:
      // this.testTexture.addressModeU = "clamp-to-edge";
      // this.testTexture.addressModeV = "repeat";

      // Or set both filters at once:
      // this.testTexture.setFilter("linear", "nearest");

      this.criticalAssetsLoaded = true;
      this.showLoadingScreen = false;

      logger.success("SpriteTestScene initialized successfully");
      return true;
    } catch (error) {
      logger.error(`SpriteTestScene initialization failed: ${error}`);
      return false;
    }
  }

  protected onLoadingProgress(progress: LoadingProgress): void {
    super.onLoadingProgress(progress);
    logger.info(
      `Loading ${progress.bundleName}: ${Math.round(progress.percentage)}% - ${
        progress.currentAsset || "Processing..."
      }`
    );
  }

  protected drawLoadingScreen(): void {
    if (!this.loadingProgress) return;

    console.log(
      `Loading: ${Math.round(this.loadingProgress.percentage)}% - ${
        this.loadingProgress.currentAsset || "Loading..."
      }`
    );
  }

  update(deltaTime: number): void {
    this.time += deltaTime;
    this.rotation += deltaTime * 0.001; // Slow rotation
  }

  fixedUpdate(_fixedTimeStep: number): void {
    // No fixed updates needed for this test
  }

  draw(_interpolationFactor: number): void {
    if (this.showLoadingScreen || !this.criticalAssetsLoaded) {
      this.drawLoadingScreen();
      return;
    }

    if (!this.testTexture || !this.testTexture.isLoaded) {
      return;
    }

    this.drawQuadTests();

    // Log rendering stats periodically
    this.logRenderingStats();
  }

  private drawQuadTests(): void {
    if (!this.testTexture) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Test 1: Basic sprite at center
    this.canvas.drawQuadEx(
      this.testTexture,
      centerX,
      centerY,
      undefined,
      undefined,
      undefined,
      0.5,
      0.5
    );

    // Test 2: Sprite with color
    this.canvas.drawQuad(this.testTexture, 0, 0, Color.BLUE);

    // Test 3: Scaled sprite with center pivot
    this.canvas.drawQuadEx(
      this.testTexture,
      centerX,
      centerY,
      Color.GREEN,
      this.testTexture.width / 2,
      this.testTexture.height / 2,
      0.5,
      0.5
    );

    // Test 4: Semi-transparent sprite
    this.canvas.drawQuadEx(
      this.testTexture,
      centerX + 100,
      centerY,
      Color.RED.withA(0.5),
      256,
      256,
      0.5,
      0.5
    );

    // Test 5: Rotating sprite (using transform methods)
    this.canvas.pushTransform();
    this.canvas.translate(centerX, centerY);
    this.canvas.rotate(this.rotation);
    this.canvas.translate(-centerX, -centerY);
    this.canvas.drawQuadEx(
      this.testTexture,
      centerX - 150,
      centerY,
      Color.fromHex("#FF00FF"),
      256,
      256,
      0.5,
      0.5
    );
    this.canvas.popTransform();

    // Test 5b: Rotating sprite (using built-in rotation parameter)
    this.canvas.drawQuadEx(
      this.testTexture,
      centerX + 150,
      centerY,
      Color.fromHex("#FF8800"),
      256,
      256,
      0.5,
      0.5,
      undefined,
      this.rotation
    );

    // Test 6: Sprite with region
    const topLeftRegion: TextureRegion = {
      x: 0,
      y: 0,
      width: this.testTexture.width / 2,
      height: this.testTexture.height / 2,
    };
    this.canvas.drawQuadEx(
      this.testTexture,
      centerX,
      centerY,
      Color.fromHex("#FFFF00"),
      256,
      256,
      0.5,
      0.5,
      topLeftRegion
    );

    // Test 7: Animated scaling sprite
    const scale = 1 + Math.sin(this.time * 0.002) * 0.3;
    this.canvas.drawQuadEx(
      this.testTexture,
      centerX,
      centerY,
      Color.fromRGBA(
        Math.sin(this.time * 0.003) * 0.5 + 0.5,
        Math.cos(this.time * 0.002) * 0.5 + 0.5,
        Math.sin(this.time * 0.004) * 0.5 + 0.5,
        1
      ),
      256 * scale,
      256 * scale,
      0.5,
      0.5
    );

    if (this.runtimeTexture) {
      this.canvas.drawQuad(this.runtimeTexture, 0, 0, Color.WHITE);
    }
  }

  private logRenderingStats(): void {
    const currentTime = Date.now();

    // Log stats every STATS_LOG_INTERVAL milliseconds
    if (currentTime - this.lastStatsLogTime >= this.STATS_LOG_INTERVAL) {
      const stats = this.canvas.getRenderingStats();

      logger.info("=== Rendering Statistics ===", Color.fromHex("#00FFFF"));
      logger.info(
        `Draw Calls: ${stats.drawCallCount}`,
        Color.fromHex("#00AAFF")
      );
      logger.info(`Batches: ${stats.batchCount}`, Color.fromHex("#00AAFF"));
      logger.info(
        `Pending Quads: ${stats.pendingQuads}`,
        Color.fromHex("#00AAFF")
      );
      logger.info(
        `Vertex Buffer Usage: ${stats.vertexBufferUsage.toFixed(1)}%`,
        Color.fromHex("#00AAFF")
      );
      logger.info(
        `Max Quads per Batch: ${stats.maxQuadsPerBatch}`,
        Color.fromHex("#00AAFF")
      );

      this.lastStatsLogTime = currentTime;
    }
  }

  cleanup(): void {
    logger.info("Cleaning up SpriteTestScene");
    // Cleanup resources if needed
  }
}
