// CircularBuffer.ts - High-performance circular buffer for event processing

/**
 * High-performance circular buffer implementation
 * Avoids expensive array operations like shift() and provides O(1) operations
 */
export class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;  // Points to the next write position
  private tail: number = 0;  // Points to the next read position
  private count: number = 0; // Number of items currently in buffer
  private readonly capacity: number;
  
  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }
  
  /**
   * Add an item to the buffer
   * @param item - Item to add
   * @returns The item that was overwritten (if buffer was full), undefined otherwise
   */
  push(item: T): T | undefined {
    let overwritten: T | undefined = undefined;
    
    if (this.count === this.capacity) {
      // Buffer is full, overwrite oldest item
      overwritten = this.buffer[this.tail] as T;
      this.tail = (this.tail + 1) % this.capacity;
    } else {
      this.count++;
    }
    
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    
    return overwritten;
  }
  
  /**
   * Remove and return the oldest item from the buffer
   * @returns The oldest item, or undefined if buffer is empty
   */
  shift(): T | undefined {
    if (this.count === 0) {
      return undefined;
    }
    
    const item = this.buffer[this.tail] as T;
    this.buffer[this.tail] = undefined; // Clear reference for GC
    this.tail = (this.tail + 1) % this.capacity;
    this.count--;
    
    return item;
  }
  
  /**
   * Get an item at a specific index without removing it
   * @param index - Index from the tail (0 = oldest item)
   * @returns The item at the index, or undefined if index is out of bounds
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.count) {
      return undefined;
    }
    
    const actualIndex = (this.tail + index) % this.capacity;
    return this.buffer[actualIndex] as T;
  }
  
  /**
   * Get the number of items currently in the buffer
   */
  get length(): number {
    return this.count;
  }
  
  /**
   * Get the maximum capacity of the buffer
   */
  get size(): number {
    return this.capacity;
  }
  
  /**
   * Check if the buffer is empty
   */
  get isEmpty(): boolean {
    return this.count === 0;
  }
  
  /**
   * Check if the buffer is full
   */
  get isFull(): boolean {
    return this.count === this.capacity;
  }
  
  /**
   * Clear all items from the buffer
   */
  clear(): void {
    // Clear all references for garbage collection
    for (let i = 0; i < this.capacity; i++) {
      this.buffer[i] = undefined;
    }
    
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
  
  /**
   * Iterate over all items in the buffer (oldest to newest)
   * @param callback - Function to call for each item
   */
  forEach(callback: (item: T, index: number) => void): void {
    // Optimize for common case where buffer hasn't wrapped
    if (this.tail + this.count <= this.capacity) {
      // No wrapping - can iterate linearly
      for (let i = 0; i < this.count; i++) {
        const item = this.buffer[this.tail + i] as T;
        callback(item, i);
      }
    } else {
      // Buffer has wrapped - use modulo arithmetic
      for (let i = 0; i < this.count; i++) {
        const actualIndex = (this.tail + i) % this.capacity;
        const item = this.buffer[actualIndex] as T;
        callback(item, i);
      }
    }
  }
  
  /**
   * Convert buffer contents to array (oldest to newest)
   * @returns Array containing all items in the buffer
   */
  toArray(): T[] {
    const result: T[] = new Array(this.count);
    
    // Optimize for common case where buffer hasn't wrapped
    if (this.tail + this.count <= this.capacity) {
      // No wrapping - can copy linearly
      for (let i = 0; i < this.count; i++) {
        result[i] = this.buffer[this.tail + i] as T;
      }
    } else {
      // Buffer has wrapped - use modulo arithmetic
      for (let i = 0; i < this.count; i++) {
        const actualIndex = (this.tail + i) % this.capacity;
        result[i] = this.buffer[actualIndex] as T;
      }
    }
    
    return result;
  }
  
  /**
   * Drain all items from the buffer and return them as an array
   * This clears the buffer in the process
   * @returns Array containing all items that were in the buffer
   */
  drain(): T[] {
    const result = this.toArray();
    this.clear();
    return result;
  }
  
  /**
   * Get debug information about the buffer state
   */
  getDebugInfo(): {
    capacity: number;
    count: number;
    head: number;
    tail: number;
    isEmpty: boolean;
    isFull: boolean;
    utilizationPercent: number;
  } {
    return {
      capacity: this.capacity,
      count: this.count,
      head: this.head,
      tail: this.tail,
      isEmpty: this.isEmpty,
      isFull: this.isFull,
      utilizationPercent: (this.count / this.capacity) * 100
    };
  }
}