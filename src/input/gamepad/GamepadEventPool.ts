// GamepadEventPool.ts - Object pooling for gamepad events to reduce GC pressure

import { type GamepadEvent } from "./GamepadEvent";
import { GamepadButtons } from "./GamepadButtons";

/**
 * High-performance object pool for GamepadEvent objects
 * Reduces garbage collection pressure by reusing event objects
 */
export class GamepadEventPool {
  private static instance: GamepadEventPool | null = null;
  
  private pool: GamepadEvent[] = [];
  private poolSize: number = 0;
  private maxPoolSize: number;
  
  // Statistics for monitoring pool efficiency
  private totalAllocated: number = 0;
  private totalReused: number = 0;
  private peakPoolSize: number = 0;
  
  constructor(maxPoolSize: number = 128) {
    this.maxPoolSize = maxPoolSize;
    this.preallocatePool();
  }
  
  /**
   * Get the singleton instance
   */
  static getInstance(): GamepadEventPool {
    if (!GamepadEventPool.instance) {
      GamepadEventPool.instance = new GamepadEventPool();
    }
    return GamepadEventPool.instance;
  }
  
  /**
   * Pre-allocate pool with event objects for optimal performance
   */
  private preallocatePool(): void {
    // Pre-allocate half the max pool size for immediate availability
    const preallocationSize = Math.floor(this.maxPoolSize / 2);
    
    for (let i = 0; i < preallocationSize; i++) {
      this.pool.push(this.createNewEvent());
      this.poolSize++;
    }
    
    this.peakPoolSize = this.poolSize;
  }
  
  /**
   * Create a new event object
   */
  private createNewEvent(): GamepadEvent {
    return {
      gamepadIndex: 0,
      button: GamepadButtons.A,
      type: 'buttondown',
      timestamp: 0,
      value: 0,
      axisIndex: undefined,
      axisValue: undefined
    };
  }
  
  /**
   * Acquire an event object from the pool for button events
   * @param gamepadIndex - The gamepad index (0-3)
   * @param button - The button that changed
   * @param type - The event type
   * @param timestamp - The event timestamp
   * @param value - The button value (0-1)
   * @returns A GamepadEvent object ready for use
   */
  acquire(
    gamepadIndex: number,
    button: GamepadButtons,
    type: 'buttondown' | 'buttonup' | 'axischange',
    timestamp: number,
    value: number,
    axisIndex?: number,
    axisValue?: number
  ): GamepadEvent {
    let event: GamepadEvent;
    
    if (this.poolSize > 0) {
      // Reuse from pool
      event = this.pool[--this.poolSize];
      this.totalReused++;
    } else {
      // Create new if pool is empty
      event = this.createNewEvent();
      this.totalAllocated++;
    }
    
    // Initialize with new values
    event.gamepadIndex = gamepadIndex;
    event.button = button;
    event.type = type;
    event.timestamp = timestamp;
    event.value = value;
    event.axisIndex = axisIndex;
    event.axisValue = axisValue;
    
    return event;
  }
  
  /**
   * Release an event object back to the pool
   * @param event - The event object to release
   */
  release(event: GamepadEvent): void {
    // Only add back to pool if we haven't exceeded max size
    if (this.poolSize < this.maxPoolSize) {
      // Clear data
      event.gamepadIndex = 0;
      event.button = GamepadButtons.A;
      event.type = 'buttondown';
      event.timestamp = 0;
      event.value = 0;
      event.axisIndex = undefined;
      event.axisValue = undefined;
      
      this.pool[this.poolSize++] = event;
      
      // Track peak pool size for monitoring
      if (this.poolSize > this.peakPoolSize) {
        this.peakPoolSize = this.poolSize;
      }
    }
    // If pool is full, let the object be garbage collected
  }
  
  /**
   * Release multiple events back to the pool efficiently
   * @param events - Array of events to release
   */
  releaseMany(events: GamepadEvent[]): void {
    for (const event of events) {
      this.release(event);
    }
  }
  
  /**
   * Get pool statistics for monitoring and debugging
   */
  getStats(): {
    poolSize: number;
    maxPoolSize: number;
    peakPoolSize: number;
    totalAllocated: number;
    totalReused: number;
    reuseRate: number;
    memoryEfficiency: number;
  } {
    const total = this.totalAllocated + this.totalReused;
    const reuseRate = total > 0 ? (this.totalReused / total) * 100 : 0;
    const memoryEfficiency = this.totalAllocated > 0 ? (this.totalReused / this.totalAllocated) * 100 : 0;
    
    return {
      poolSize: this.poolSize,
      maxPoolSize: this.maxPoolSize,
      peakPoolSize: this.peakPoolSize,
      totalAllocated: this.totalAllocated,
      totalReused: this.totalReused,
      reuseRate: reuseRate,
      memoryEfficiency: memoryEfficiency
    };
  }
  
  /**
   * Clear the pool and reset statistics
   */
  clear(): void {
    this.pool.length = 0;
    this.poolSize = 0;
    this.totalAllocated = 0;
    this.totalReused = 0;
    this.peakPoolSize = 0;
  }
  
  /**
   * Resize the pool (useful for dynamic optimization)
   * @param newMaxSize - New maximum pool size
   */
  resize(newMaxSize: number): void {
    this.maxPoolSize = newMaxSize;
    
    // Trim pool if it's now larger than max
    if (this.poolSize > newMaxSize) {
      this.pool.length = newMaxSize;
      this.poolSize = newMaxSize;
    }
  }
  
  /**
   * Pre-warm the pool by allocating objects
   * @param count - Number of objects to pre-allocate
   */
  prewarm(count: number): void {
    const targetSize = Math.min(count, this.maxPoolSize);
    
    while (this.poolSize < targetSize) {
      this.pool[this.poolSize++] = this.createNewEvent();
    }
    
    if (this.poolSize > this.peakPoolSize) {
      this.peakPoolSize = this.poolSize;
    }
  }
}