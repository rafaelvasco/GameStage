// MouseEventPool.ts - Object pooling for mouse events to reduce GC pressure

import { type MouseInputEvent } from "./MouseEvent";

/**
 * High-performance object pool for MouseEvent objects
 * Reduces garbage collection pressure by reusing event objects
 */
export class MouseEventPool {
  private static instance: MouseEventPool | null = null;
  
  private pool: MouseInputEvent[] = [];
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
  static getInstance(): MouseEventPool {
    if (!MouseEventPool.instance) {
      MouseEventPool.instance = new MouseEventPool();
    }
    return MouseEventPool.instance;
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
  private createNewEvent(): MouseInputEvent {
    return {
      button: 0,
      type: 'mousedown',
      timestamp: 0,
      x: 0,
      y: 0,
      deltaX: 0,
      deltaY: 0,
      deltaZ: 0
    };
  }
  
  /**
   * Acquire an event object from the pool
   * @param button - The mouse button
   * @param type - The event type
   * @param timestamp - The event timestamp
   * @param repeat - Unused for mouse events (compatibility with keyboard)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param deltaX - Optional wheel delta X
   * @param deltaY - Optional wheel delta Y
   * @param deltaZ - Optional wheel delta Z
   * @returns A MouseEvent object ready for use
   */
  acquire(
    button: number, 
    type: 'mousedown' | 'mouseup' | 'mousemove' | 'wheel', 
    timestamp: number, 
    _repeat: boolean, // Unused, for compatibility with EventPool interface
    x: number, 
    y: number,
    deltaX?: number,
    deltaY?: number,
    deltaZ?: number
  ): MouseInputEvent {
    let event: MouseInputEvent;
    
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
    event.button = button;
    event.type = type;
    event.timestamp = timestamp;
    event.x = x;
    event.y = y;
    event.deltaX = deltaX;
    event.deltaY = deltaY;
    event.deltaZ = deltaZ;
    
    return event;
  }
  
  /**
   * Release an event object back to the pool
   * @param event - The event object to release
   */
  release(event: MouseInputEvent): void {
    // Only add back to pool if we haven't exceeded max size
    if (this.poolSize < this.maxPoolSize) {
      // Clear data
      event.button = 0;
      event.type = 'mousedown';
      event.timestamp = 0;
      event.x = 0;
      event.y = 0;
      event.deltaX = 0;
      event.deltaY = 0;
      event.deltaZ = 0;
      
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
  releaseMany(events: MouseInputEvent[]): void {
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