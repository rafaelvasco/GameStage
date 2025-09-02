// BitFlags.ts - High-performance bit flag operations for input state tracking

/**
 * High-performance bit flag system for tracking boolean states
 * Uses multiple 32-bit integers to support unlimited flags
 * 
 * Performance benefits:
 * - O(1) set/get operations
 * - O(1) hasAny/hasAll operations
 * - Minimal memory usage
 * - Cache-friendly data structure
 */
export class BitFlags {
  private buckets: Uint32Array;
  private bucketCount: number;
  private size: number;
  
  // Constants for bit operations
  private static readonly BITS_PER_BUCKET = 32;
  private static readonly BUCKET_MASK = 0x1F; // 32 - 1
  private static readonly BUCKET_SHIFT = 5;   // log2(32)
  
  constructor(initialSize: number = 256) {
    this.size = initialSize;
    this.bucketCount = Math.ceil(initialSize / BitFlags.BITS_PER_BUCKET);
    this.buckets = new Uint32Array(this.bucketCount);
  }
  
  /**
   * Set a flag at the specified index
   * @param index - The flag index to set
   * @param value - True to set, false to clear
   */
  set(index: number, value: boolean): void {
    if (index < 0) {
      throw new Error(`Invalid flag index: ${index}. Index must be non-negative.`);
    }
    
    if (index >= this.size) {
      this.resize(index + 1);
    }
    
    const bucketIndex = index >>> BitFlags.BUCKET_SHIFT;
    const bitIndex = index & BitFlags.BUCKET_MASK;
    
    if (value) {
      this.buckets[bucketIndex] |= (1 << bitIndex);
    } else {
      this.buckets[bucketIndex] &= ~(1 << bitIndex);
    }
  }
  
  /**
   * Get the value of a flag at the specified index
   * @param index - The flag index to check
   * @returns True if the flag is set
   */
  get(index: number): boolean {
    if (index < 0 || index >= this.size) return false;
    
    const bucketIndex = index >>> BitFlags.BUCKET_SHIFT;
    const bitIndex = index & BitFlags.BUCKET_MASK;
    
    return (this.buckets[bucketIndex] & (1 << bitIndex)) !== 0;
  }
  
  /**
   * Check if any flags are set
   * @returns True if any flag is set
   */
  hasAny(): boolean {
    for (let i = 0; i < this.bucketCount; i++) {
      if (this.buckets[i] !== 0) return true;
    }
    return false;
  }
  
  /**
   * Check if any of the specified flags are set
   * @param indices - Array of flag indices to check
   * @returns True if any of the specified flags are set
   */
  hasAnyOf(indices: number[]): boolean {
    for (const index of indices) {
      if (this.get(index)) return true;
    }
    return false;
  }
  
  /**
   * Check if all of the specified flags are set
   * @param indices - Array of flag indices to check
   * @returns True if all of the specified flags are set
   */
  hasAllOf(indices: number[]): boolean {
    for (const index of indices) {
      if (!this.get(index)) return false;
    }
    return true;
  }
  
  /**
   * Get all indices that have their flags set
   * @returns Array of indices where flags are set
   */
  getSetIndices(): number[] {
    const result: number[] = [];
    
    for (let bucketIndex = 0; bucketIndex < this.bucketCount; bucketIndex++) {
      const bucket = this.buckets[bucketIndex];
      if (bucket === 0) continue;
      
      const baseIndex = bucketIndex << BitFlags.BUCKET_SHIFT;
      
      // Check each bit in the bucket
      for (let bitIndex = 0; bitIndex < BitFlags.BITS_PER_BUCKET; bitIndex++) {
        if ((bucket & (1 << bitIndex)) !== 0) {
          const index = baseIndex + bitIndex;
          if (index < this.size) {
            result.push(index);
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * Clear all flags
   */
  clear(): void {
    this.buckets.fill(0);
  }
  
  /**
   * Clear a specific flag
   * @param index - The flag index to clear
   */
  clearFlag(index: number): void {
    this.set(index, false);
  }
  
  /**
   * Set multiple flags at once
   * @param indices - Array of flag indices to set
   * @param value - Value to set for all flags
   */
  setMultiple(indices: number[], value: boolean): void {
    for (const index of indices) {
      this.set(index, value);
    }
  }
  
  /**
   * Get the number of set flags (optimized with Brian Kernighan's algorithm)
   * @returns Count of flags that are set
   */
  getSetCount(): number {
    let count = 0;
    
    for (let i = 0; i < this.bucketCount; i++) {
      // Use Brian Kernighan's algorithm for efficient bit counting
      let bucket = this.buckets[i];
      while (bucket) {
        bucket &= bucket - 1; // Clear the lowest set bit
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Resize the bit flag array to accommodate more flags
   * @param newSize - New size for the bit flag array
   */
  private resize(newSize: number): void {
    const newBucketCount = Math.ceil(newSize / BitFlags.BITS_PER_BUCKET);
    
    if (newBucketCount > this.bucketCount) {
      const newBuckets = new Uint32Array(newBucketCount);
      newBuckets.set(this.buckets);
      this.buckets = newBuckets;
      this.bucketCount = newBucketCount;
    }
    
    this.size = newSize;
  }
  
  /**
   * Get debug information about the bit flags
   */
  getDebugInfo(): {
    size: number;
    bucketCount: number;
    setCount: number;
    memoryUsage: number;
  } {
    return {
      size: this.size,
      bucketCount: this.bucketCount,
      setCount: this.getSetCount(),
      memoryUsage: this.bucketCount * 4 // 4 bytes per Uint32
    };
  }
  
  /**
   * Create a copy of the current bit flags
   * @returns New BitFlags instance with the same state
   */
  clone(): BitFlags {
    const clone = new BitFlags(this.size);
    clone.buckets.set(this.buckets);
    return clone;
  }
  
  /**
   * Perform bitwise OR operation with another BitFlags instance
   * @param other - Other BitFlags instance to OR with
   * @returns New BitFlags instance with the result
   */
  or(other: BitFlags): BitFlags {
    const maxSize = Math.max(this.size, other.size);
    const result = new BitFlags(maxSize);
    
    const maxBuckets = Math.max(this.bucketCount, other.bucketCount);
    for (let i = 0; i < maxBuckets; i++) {
      const thisBucket = i < this.bucketCount ? this.buckets[i] : 0;
      const otherBucket = i < other.bucketCount ? other.buckets[i] : 0;
      result.buckets[i] = thisBucket | otherBucket;
    }
    
    return result;
  }
  
  /**
   * Perform bitwise AND operation with another BitFlags instance
   * @param other - Other BitFlags instance to AND with
   * @returns New BitFlags instance with the result
   */
  and(other: BitFlags): BitFlags {
    const maxSize = Math.max(this.size, other.size);
    const result = new BitFlags(maxSize);
    
    const minBuckets = Math.min(this.bucketCount, other.bucketCount);
    for (let i = 0; i < minBuckets; i++) {
      result.buckets[i] = this.buckets[i] & other.buckets[i];
    }
    
    return result;
  }
}