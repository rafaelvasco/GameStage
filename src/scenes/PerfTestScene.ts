import { Scene } from "./Scene";
import { Canvas } from "../graphics/Canvas";
import { Content } from "../content/Content";
import { Texture2D } from "../content/image/Texture2D";
import { LoadingProgress } from "../content";
import { logger } from "../utils";

interface Rectangle {
  // Current physics state
  x: number;
  y: number;
  velX: number;
  velY: number;
  width: number;
  height: number;

  // Previous position for interpolation
  prevX: number;
  prevY: number;
}

export class PerfTestScene extends Scene {
  private testTexture: Texture2D | null = null;
  private rectangles: Rectangle[] = [];
  private rectSpeed: number = 200; // pixels per second
  private numRectangles: number = 50;

  // Loading state
  private showLoadingScreen: boolean = true;
  private criticalAssetsLoaded: boolean = false;

  private rotation: number = 0;

  constructor(canvas: Canvas, content: Content) {
    super(canvas, content);
  }

  async initialize(): Promise<boolean> {
    logger.info("Initializing PerfTestScene with enhanced asset loading...");

    try {
      const preloadLoaded = await this.content.loadBundle(
        "perf-test",
        (progress) => this.onLoadingProgress(progress)
      );

      if (!preloadLoaded) {
        logger.error("Failed to load preload assets for PerfTestScene");
        return false;
      }

      // Initialize core scene elements with preload assets
      this.testTexture = this.content.get<Texture2D>("guitar");

      this.initializeRectangles();
      this.criticalAssetsLoaded = true;
      this.showLoadingScreen = false;

      logger.success("Preload assets loaded successfully");

      return true;
    } catch (error) {
      logger.error(`PerfTestScene initialization failed: ${error}`);
      return false;
    }
  }

  protected onLoadingProgress(progress: LoadingProgress): void {
    super.onLoadingProgress(progress);

    // Log detailed progress information
    logger.info(
      `Loading ${progress.bundleName}: ${progress.loadedAssets}/${progress.totalAssets} assets ` +
        `(${Math.round(progress.percentage)}%) - ${
          progress.currentAsset || "Processing..."
        }`
    );
  }

  protected drawLoadingScreen(): void {
    if (!this.loadingProgress) return;

    //const centerX = this.canvas.width / 2;
    //const centerY = this.canvas.height / 2;

    // For now, we'll log the progress since we don't have text/rect drawing methods
    // In a real implementation, you would draw progress bars and text here

    const progressText = `Loading ${this.loadingProgress.bundleName}...`;
    const percentageText = `${Math.round(this.loadingProgress.percentage)}%`;
    const assetText = this.loadingProgress.currentAsset || "Processing...";
    const fileProgressText = `${this.loadingProgress.loadedAssets}/${this.loadingProgress.totalAssets} files`;

    // Log progress to console (replace with actual drawing when Canvas supports it)
    console.log(
      `${progressText} ${percentageText} - ${assetText} (${fileProgressText})`
    );

    // TODO: When Canvas has drawing methods, implement:
    // - Progress bar background rectangle
    // - Progress bar fill rectangle
    // - Loading text
    // - Percentage text
    // - Current asset text
    // - File count text
  }

  private initializeRectangles(): void {
    this.rectangles = [];

    for (let i = 0; i < this.numRectangles; i++) {
      const rect: Rectangle = {
        width: 64,
        height: 64,
        // Random starting position
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        // Random velocity direction with varying speeds
        velX: 0,
        velY: 0,
        prevX: 0,
        prevY: 0,
      };

      // Ensure rectangles start within bounds
      rect.x = Math.max(
        rect.width / 2,
        Math.min(this.canvas.width - rect.width / 2, rect.x)
      );
      rect.y = Math.max(
        rect.height / 2,
        Math.min(this.canvas.height - rect.height / 2, rect.y)
      );

      // Initialize previous position to current position
      rect.prevX = rect.x;
      rect.prevY = rect.y;

      // Set initial random velocity direction with some speed variation
      const angle = Math.random() * Math.PI * 2;
      const speed = this.rectSpeed * (0.5 + Math.random() * 0.5); // 50% to 100% of base speed
      rect.velX = Math.cos(angle) * speed;
      rect.velY = Math.sin(angle) * speed;

      this.rectangles.push(rect);
    }

    logger.info(`Initialized ${this.rectangles.length} bouncing rectangles`);
  }

  update(deltaTime: number): void {
    this.rotation += deltaTime * 0.001; // Rotate slowly
  }

  fixedUpdate(fixedTimeStep: number): void {
    // Don't update physics if we're still loading critical assets
    if (
      !this.criticalAssetsLoaded ||
      !this.testTexture ||
      !this.testTexture.isLoaded
    ) {
      return;
    }

    // Convert fixed timestep from milliseconds to seconds
    const dt = fixedTimeStep / 1000;

    // Update each rectangle
    for (const rect of this.rectangles) {
      // Store previous position for interpolation
      rect.prevX = rect.x;
      rect.prevY = rect.y;

      // Update position using fixed timestep
      rect.x += rect.velX * dt;
      rect.y += rect.velY * dt;

      // Check for bouncing off screen edges
      // Left and right edges
      if (rect.x - rect.width / 2 <= 0) {
        rect.x = rect.width / 2;
        rect.velX = Math.abs(rect.velX); // Bounce right
      } else if (rect.x + rect.width / 2 >= this.canvas.width) {
        rect.x = this.canvas.width - rect.width / 2;
        rect.velX = -Math.abs(rect.velX); // Bounce left
      }

      // Top and bottom edges
      if (rect.y - rect.height / 2 <= 0) {
        rect.y = rect.height / 2;
        rect.velY = Math.abs(rect.velY); // Bounce down
      } else if (rect.y + rect.height / 2 >= this.canvas.height) {
        rect.y = this.canvas.height - rect.height / 2;
        rect.velY = -Math.abs(rect.velY); // Bounce up
      }
    }
  }

  draw(interpolationFactor: number): void {
    // Show loading screen if we're still loading critical assets
    if (this.showLoadingScreen && this.isLoading) {
      this.drawLoadingScreen();
      return;
    }

    // Draw the normal scene if critical assets are loaded
    if (
      this.criticalAssetsLoaded &&
      this.testTexture &&
      this.testTexture.isLoaded
    ) {
      this.drawScene(interpolationFactor);
    }
  }

  private drawScene(interpolationFactor: number): void {
    // Draw all rectangles
    for (const rect of this.rectangles) {
      // Interpolate between previous and current position
      const interpolatedX =
        rect.prevX + (rect.x - rect.prevX) * interpolationFactor;
      const interpolatedY =
        rect.prevY + (rect.y - rect.prevY) * interpolationFactor;

      const pixelPerfectX = Math.floor(interpolatedX);
      const pixelPerfectY = Math.floor(interpolatedY);

      // Draw sprite directly without creating a Sprite instance
      this.canvas.drawQuadEx(
        this.testTexture!,
        pixelPerfectX,
        pixelPerfectY,
        undefined,
        rect.width,
        rect.height
      );
    }
  }

  cleanup(): void {
    // Clean up scene-specific resources if needed
    // The content manager will handle texture cleanup
    this.rectangles = [];

    logger.info("PerfTestScene cleanup completed");
  }
}
