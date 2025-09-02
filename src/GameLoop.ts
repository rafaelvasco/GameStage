import { Game } from "./Game";
import { logger } from "./utils";
import Platform from "./utils/Platform";

export class GameLoop {
  private static readonly DEFAULT_FRAMERATE = 60;
  private static readonly TIME_HISTORY_COUNT = 4;
  private static _instance: GameLoop | null = null;

  private _updateRate: number = 0;

  private _inactiveSleepTime: number = 20; // milliseconds
  private _running: boolean = false;
  private _isActive: boolean = true;

  private _resync: boolean = true;
  private _fixedDeltatime: number = 0;
  private _desiredFrametime: number = 0;
  private _vsyncMaxError: number = 0;
  private readonly _snapFreqs: number[];
  private readonly _timeAverager: number[];
  private _timeAveragerIndex: number = 0;
  private _suppressDraw: boolean = false;

  private _prevFrameTime: number = 0;
  private _frameAccum: number = 0;

  private platform: Platform;

  // Frame rate monitoring for spike detection
  private frameTimeHistory: number[] = new Array(60); // 1 second of history at 60fps
  private frameTimeIndex: number = 0;
  private lastFrameTime: number = 0;
  private frameSpikes: number = 0;
  private frameDrops: number = 0;
  private readonly SPIKE_THRESHOLD_MS = 20; // 20ms+ considered a spike
  private readonly DROP_THRESHOLD_MS = 25; // 25ms+ considered a frame drop

  // Cached stats object to avoid allocations
  private cachedFrameStats = {
    averageFPS: 0,
    minFrameTime: 0,
    maxFrameTime: 0,
    frameSpikes: 0,
    frameDrops: 0,
    currentFrameTime: 0,
  };

  private constructor() {
    logger.info("Initializing GameLoop");
    this.platform = Platform.getInstance();

    const time60Hz = this.platform.getPerfFreq() / 60;
    this._snapFreqs = [
      time60Hz, // 60fps
      time60Hz * 2, // 30fps
      time60Hz * 3, // 20fps
      time60Hz * 4, // 15fps
      (time60Hz + 1) / 2, // 120fps
    ];

    this._timeAverager = new Array(GameLoop.TIME_HISTORY_COUNT);
    for (let i = 0; i < GameLoop.TIME_HISTORY_COUNT; i++) {
      this._timeAverager[i] = this._desiredFrametime;
    }
    this._timeAveragerIndex = 0;

    // Initialize frame time history
    this.frameTimeHistory.fill(16.67); // Start with 60fps baseline

    this.resetLoop(GameLoop.DEFAULT_FRAMERATE);
  }

  static getInstance(): GameLoop {
    if (!GameLoop._instance) {
      GameLoop._instance = new GameLoop();
    }
    return GameLoop._instance;
  }

  get updateRate(): number {
    return this._updateRate;
  }

  set updateRate(value: number) {
    this.resetLoop(value);
  }

  get inactiveSleepTime(): number {
    return this._inactiveSleepTime;
  }

  set inactiveSleepTime(value: number) {
    if (value < 0) {
      throw new Error("The time must be positive.");
    }
    this._inactiveSleepTime = value;
  }

  get running(): boolean {
    return this._running;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  set isActive(value: boolean) {
    this._isActive = value;
  }

  suppressDraw(): void {
    this._suppressDraw = true;
  }

  private resetLoop(desiredUpdateRate: number): void {
    this._updateRate = desiredUpdateRate;
    this._frameAccum = 0;
    this._prevFrameTime = 0;
    this._fixedDeltatime = 1.0 / this._updateRate;
    this._desiredFrametime = this.platform.getPerfFreq() / this._updateRate;
    this._vsyncMaxError = this.platform.getPerfFreq() * 0.0002;

    // Reset time averager with new frametime
    for (let i = 0; i < GameLoop.TIME_HISTORY_COUNT; i++) {
      this._timeAverager[i] = this._desiredFrametime;
    }
    this._timeAveragerIndex = 0;
  }

  start(game: Game): void {
    this._running = true;
    this._prevFrameTime = this.platform.getPerfCounter();
    this._frameAccum = 0;
    this.tick(game);
  }

  terminate(): void {
    this._running = false;
    this.suppressDraw();
  }

  /**
   * Track frame timing for performance monitoring and spike detection
   */
  private trackFrameTiming(): void {
    const currentTime = this.platform.getHighResTime();

    if (this.lastFrameTime > 0) {
      const frameTimeMs = currentTime - this.lastFrameTime;

      // Store in circular buffer
      this.frameTimeHistory[this.frameTimeIndex] = frameTimeMs;
      this.frameTimeIndex =
        (this.frameTimeIndex + 1) % this.frameTimeHistory.length;

      // Detect spikes and drops
      if (frameTimeMs > this.SPIKE_THRESHOLD_MS) {
        this.frameSpikes++;
        if (frameTimeMs > this.DROP_THRESHOLD_MS) {
          this.frameDrops++;
        }
      }
    }

    this.lastFrameTime = currentTime;
  }

  /**
   * Get frame rate statistics for debugging (uses cached object to avoid allocations)
   */
  getFrameStats(): {
    averageFPS: number;
    minFrameTime: number;
    maxFrameTime: number;
    frameSpikes: number;
    frameDrops: number;
    currentFrameTime: number;
  } {
    // Calculate stats without creating temporary arrays
    let validCount = 0;
    let sum = 0;
    let minFrameTime = Infinity;
    let maxFrameTime = 0;

    for (let i = 0; i < this.frameTimeHistory.length; i++) {
      const time = this.frameTimeHistory[i];
      if (time > 0) {
        validCount++;
        sum += time;
        if (time < minFrameTime) minFrameTime = time;
        if (time > maxFrameTime) maxFrameTime = time;
      }
    }

    if (validCount === 0) {
      this.cachedFrameStats.averageFPS = 0;
      this.cachedFrameStats.minFrameTime = 0;
      this.cachedFrameStats.maxFrameTime = 0;
      this.cachedFrameStats.frameSpikes = this.frameSpikes;
      this.cachedFrameStats.frameDrops = this.frameDrops;
      this.cachedFrameStats.currentFrameTime = 0;
      return this.cachedFrameStats;
    }

    const avgFrameTime = sum / validCount;
    const averageFPS = 1000 / avgFrameTime;

    this.cachedFrameStats.averageFPS = Math.round(averageFPS * 10) / 10;
    this.cachedFrameStats.minFrameTime = Math.round(minFrameTime * 100) / 100;
    this.cachedFrameStats.maxFrameTime = Math.round(maxFrameTime * 100) / 100;
    this.cachedFrameStats.frameSpikes = this.frameSpikes;
    this.cachedFrameStats.frameDrops = this.frameDrops;
    this.cachedFrameStats.currentFrameTime =
      this.frameTimeHistory[
        (this.frameTimeIndex - 1 + this.frameTimeHistory.length) %
          this.frameTimeHistory.length
      ];

    return this.cachedFrameStats;
  }

  /**
   * Reset frame statistics
   */
  resetFrameStats(): void {
    this.frameSpikes = 0;
    this.frameDrops = 0;
    this.frameTimeHistory.fill(16.67);
    this.frameTimeIndex = 0;
  }

  tick(game: Game): void {
    if (!this._isActive && this._inactiveSleepTime >= 1.0) {
      // Skip frame when inactive to save CPU - browser handles this automatically
      // setTimeout removed to prevent timing irregularities
      if (this._running) {
        requestAnimationFrame(() => this.tick(game));
      }
      return;
    }

    const currentFrameTime = this.platform.getPerfCounter();
    let deltaTime = currentFrameTime - this._prevFrameTime;
    this._prevFrameTime = currentFrameTime;

    // Handle unexpected timer anomalies (overflow, extra slow frames, etc.)
    if (deltaTime > this._desiredFrametime * 8) {
      deltaTime = this._desiredFrametime;
    }

    if (deltaTime < 0) {
      deltaTime = 0;
    }

    // VSync Time Snapping - Optimized with early exit
    const snapFreqsLength = this._snapFreqs.length;
    for (let i = 0; i < snapFreqsLength; ++i) {
      const snapFreq = this._snapFreqs[i];
      const timeDiff = deltaTime - snapFreq;
      if (
        timeDiff < 0
          ? -timeDiff < this._vsyncMaxError
          : timeDiff < this._vsyncMaxError
      ) {
        deltaTime = snapFreq;
        break;
      }
    }

    // Delta Time Averaging using circular buffer (no array shifting)
    this._timeAverager[this._timeAveragerIndex] = deltaTime;
    this._timeAveragerIndex =
      (this._timeAveragerIndex + 1) % GameLoop.TIME_HISTORY_COUNT;

    // Calculate average without additional allocations
    deltaTime = 0;
    for (let i = 0; i < GameLoop.TIME_HISTORY_COUNT; ++i) {
      deltaTime += this._timeAverager[i];
    }
    deltaTime /= GameLoop.TIME_HISTORY_COUNT;

    // Add To Accumulator
    this._frameAccum += deltaTime;

    // Spiral of Death Protection
    if (this._frameAccum > this._desiredFrametime * 8) {
      this._resync = true;
    }

    // Timer Resync Requested
    if (this._resync) {
      this._frameAccum = 0;
      deltaTime = this._desiredFrametime;
      this._resync = false;
    }

    let consumedDeltaTime = deltaTime;

    while (this._frameAccum >= this._desiredFrametime) {
      game.internalFixedUpdate(this._fixedDeltatime);

      // Cap Variable Update's dt to not be larger than fixed update,
      // and interleave it (so game state can always get animation frame it needs)
      if (consumedDeltaTime > this._desiredFrametime) {
        game.internalUpdate(this._fixedDeltatime);
        consumedDeltaTime -= this._desiredFrametime;
      }

      this._frameAccum -= this._desiredFrametime;
    }

    game.internalUpdate(consumedDeltaTime / this.platform.getPerfFreq());

    if (!this._suppressDraw) {
      game.internalDraw(this._frameAccum / this._desiredFrametime);
    } else {
      this._suppressDraw = false;
    }

    // Track frame timing for spike detection
    this.trackFrameTiming();

    // Continue the loop if still running
    if (this._running) {
      requestAnimationFrame(() => this.tick(game));
    }
  }
}
