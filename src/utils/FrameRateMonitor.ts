// FrameRateMonitor.ts - Utility for monitoring and displaying frame rate statistics

import { GameLoop } from "../GameLoop";
import { Logger } from "./Logger";
import { Color } from "../graphics/Color";

/**
 * Frame rate monitoring utility for detecting and diagnosing performance issues
 */
export class FrameRateMonitor {
  private static instance: FrameRateMonitor | null = null;
  private logger: Logger;
  private gameLoop: GameLoop;
  private isEnabled: boolean = false;
  private updateInterval: number = 1000; // Update every 1 second
  private lastUpdateTime: number = 0;

  private constructor() {
    this.logger = Logger.getInstance();
    this.gameLoop = GameLoop.getInstance();
  }

  static getInstance(): FrameRateMonitor {
    if (!FrameRateMonitor.instance) {
      FrameRateMonitor.instance = new FrameRateMonitor();
    }
    return FrameRateMonitor.instance;
  }

  /**
   * Enable frame rate monitoring
   * @param updateIntervalMs - How often to update stats (in milliseconds)
   */
  enable(updateIntervalMs: number = 1000): void {
    this.isEnabled = true;
    this.updateInterval = updateIntervalMs;
    this.lastUpdateTime = performance.now();
    
    this.logger.info("Frame rate monitoring enabled", Color.fromHex("#00FF88"));
  }

  /**
   * Disable frame rate monitoring
   */
  disable(): void {
    this.isEnabled = false;
    this.logger.info("Frame rate monitoring disabled");
  }

  /**
   * Update the monitor (should be called each frame)
   */
  update(): void {
    if (!this.isEnabled) return;

    const currentTime = performance.now();
    if (currentTime - this.lastUpdateTime >= this.updateInterval) {
      this.reportStats();
      this.lastUpdateTime = currentTime;
    }
  }

  /**
   * Report current frame rate statistics
   */
  private reportStats(): void {
    const stats = this.gameLoop.getFrameStats();
    
    // Only log to console if performance is below acceptable thresholds to reduce log spam
    if (stats.averageFPS < 55 || stats.frameSpikes > 5 || stats.frameDrops > 2) {
      this.logger.info(`Performance Alert - FPS: ${stats.averageFPS} | Frame: ${stats.currentFrameTime.toFixed(2)}ms | Spikes: ${stats.frameSpikes} | Drops: ${stats.frameDrops}`, 
        Color.fromHex("#FFAA00"));
    }
    
    // Detailed warnings for significant issues
    if (stats.averageFPS < 45) {
      this.logger.warn(`Low FPS detected: ${stats.averageFPS} (target: 60)`, Color.fromHex("#FF6600"));
    }
    
    if (stats.frameSpikes > 10) {
      this.logger.warn(`Excessive frame spikes: ${stats.frameSpikes} spikes in last ${this.updateInterval}ms period`, Color.fromHex("#FFAA00"));
    }
    
    if (stats.frameDrops > 5) {
      this.logger.warn(`Frame drops detected: ${stats.frameDrops} drops in last ${this.updateInterval}ms period`, Color.fromHex("#FF6600"));
    }
  }


  /**
   * Get current frame statistics
   */
  getCurrentStats() {
    return this.gameLoop.getFrameStats();
  }

  /**
   * Reset frame statistics
   */
  resetStats(): void {
    this.gameLoop.resetFrameStats();
    this.logger.info("Frame rate statistics reset");
  }

  /**
   * Check if monitoring is enabled
   */
  get enabled(): boolean {
    return this.isEnabled;
  }
}