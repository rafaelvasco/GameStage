import { Canvas } from "../graphics";
import { Content } from "../content";
import { LoadingProgress } from "../content";
import { Color } from "../graphics/Color";
import { InputManager } from "../input";

export abstract class Scene {
  protected canvas: Canvas;
  protected content: Content;
  protected input: InputManager;

  // Loading state management
  protected isLoading: boolean = false;
  protected loadingProgress: LoadingProgress | null = null;

  constructor(canvas: Canvas, content: Content) {
    this.canvas = canvas;
    this.content = content;
    this.input = InputManager.getInstance();
  }

  /**
   * Called when the scene is first loaded
   */
  abstract initialize(): Promise<boolean>;

  /**
   * Called every frame for variable timestep updates
   * @param deltaTime Time since last frame in milliseconds
   */
  abstract update(deltaTime: number): void;

  /**
   * Called at fixed intervals for consistent physics/logic updates
   * @param fixedTimeStep Fixed timestep in milliseconds
   */
  abstract fixedUpdate(fixedTimeStep: number): void;

  /**
   * Called every frame to render the scene
   * @param interpolationFactor Factor for interpolating between fixed update steps (0-1)
   */
  abstract draw(interpolationFactor: number): void;

  /**
   * Main render method that handles both loading screen and scene rendering
   * This should be called by the game loop instead of draw() directly
   * @param interpolationFactor Factor for interpolating between fixed update steps (0-1)
   */
  render(interpolationFactor: number): void {
    if (this.isLoading) {
      this.drawLoadingScreen();
    } else {
      this.draw(interpolationFactor);
    }
  }

  /**
   * Called when the scene is being unloaded
   */
  abstract cleanup(): void;

  /**
   * Called when loading progress updates
   * Override in derived classes to handle progress updates
   */
  protected onLoadingProgress(progress: LoadingProgress): void {
    this.loadingProgress = progress;
    this.isLoading = !progress.isComplete;
  }

  /**
   * Override to provide custom loading screen
   * Default implementation draws a simple progress bar
   */
  protected drawLoadingScreen(): void {
    if (!this.loadingProgress) return;

    this.drawDefaultLoadingScreen();
  }

  /**
   * Draw the default loading screen with progress bar and text
   * Can be called by custom loading screens to include default elements
   */
  protected drawDefaultLoadingScreen(): void {
    if (!this.loadingProgress) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Draw background
    this.canvas.fillRect(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      Color.BLACK
    );

    // Draw "Loading..." text
    const loadingText = "Loading...";
    const textMeasure = this.canvas.measureText(loadingText);
    this.canvas.drawText(
      loadingText,
      centerX - textMeasure.width / 2,
      centerY - 40,
      Color.WHITE
    );

    // Draw progress bar background
    const barWidth = 300;
    const barHeight = 20;
    const barX = centerX - barWidth / 2;
    const barY = centerY - 10;

    this.canvas.fillRect(barX, barY, barWidth, barHeight, Color.DARK_GRAY);
    this.canvas.drawRect(barX, barY, barWidth, barHeight, Color.WHITE, 2);

    // Draw progress bar fill
    const fillWidth = (barWidth - 4) * (this.loadingProgress.percentage / 100);
    if (fillWidth > 0) {
      this.canvas.fillRect(
        barX + 2,
        barY + 2,
        fillWidth,
        barHeight - 4,
        Color.CYAN
      );
    }

    // Draw percentage text
    const percentageText = `${Math.round(this.loadingProgress.percentage)}%`;
    const percentageMeasure = this.canvas.measureText(percentageText);
    this.canvas.drawText(
      percentageText,
      centerX - percentageMeasure.width / 2,
      centerY + 25,
      Color.WHITE
    );

    // Draw current asset name if available
    if (this.loadingProgress.currentAsset) {
      const assetText = this.loadingProgress.currentAsset;
      const assetMeasure = this.canvas.measureText(assetText);
      this.canvas.drawText(
        assetText,
        centerX - assetMeasure.width / 2,
        centerY + 45,
        Color.LIGHT_GRAY
      );
    }
  }

  /**
   * Check if the scene is currently loading assets
   */
  get isLoadingAssets(): boolean {
    return this.isLoading;
  }

  /**
   * Get current loading progress
   */
  get currentLoadingProgress(): LoadingProgress | null {
    return this.loadingProgress;
  }

  /**
   * Helper method to get loading progress percentage (0-100)
   */
  protected getLoadingPercentage(): number {
    return this.loadingProgress?.percentage || 0;
  }

  /**
   * Helper method to get current asset being loaded
   */
  protected getCurrentAsset(): string | null {
    return this.loadingProgress?.currentAsset || null;
  }

  /**
   * Helper method to check if loading is complete
   */
  protected isLoadingComplete(): boolean {
    return this.loadingProgress?.isComplete || false;
  }
}
