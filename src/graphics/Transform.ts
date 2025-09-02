// Transform.ts - Centralized transform stack management with object pooling

import { Matrix } from "../utils";
import { Logger } from "../utils";
import { Color } from "./Color";

/**
 * Static class for managing transform operations with efficient memory pooling.
 * 
 * Features:
 * - Object pooling for Float32Array matrices to eliminate memory leaks
 * - Stack depth monitoring and limits
 * - Automatic cleanup mechanisms
 * - Exception-safe transform operations
 * - Performance monitoring and statistics
 */
export class Transform {
  // Object pool for matrix reuse
  private static matrixPool: Float32Array[] = [];
  private static readonly DEFAULT_POOL_SIZE = 32;
  private static readonly MAX_STACK_DEPTH = 64;
  
  // Transform stacks (per instance/context)
  private static transformStacks = new Map<string, Float32Array[]>();
  private static currentTransforms = new Map<string, Float32Array>();
  private static currentInverseTransforms = new Map<string, Float32Array>();
  private static inverseTransformsDirty = new Map<string, boolean>();
  
  // Monitoring and statistics
  private static maxObservedStackDepth = 0;
  private static totalAllocations = 0;
  private static poolHits = 0;
  private static poolMisses = 0;
  
  // Use Matrix utility temp matrices to avoid duplication
  // (removed tempMatrix1 and tempMatrix2 - using Matrix.getTempMatrix1/2() instead)
  
  // Logger instance
  private static logger: Logger;
  
  /**
   * Initialize the Transform system with pre-allocated matrix pool
   */
  static initialize(): void {
    this.logger = Logger.getInstance();
    
    // Pre-allocate matrix pool
    for (let i = 0; i < this.DEFAULT_POOL_SIZE; i++) {
      this.matrixPool.push(new Float32Array(16));
      this.totalAllocations++;
    }
    
    this.logger.info(
      `Transform system initialized with ${this.DEFAULT_POOL_SIZE} pooled matrices`,
      Color.fromHex("#44FF44")
    );
  }
  
  /**
   * Create a new transform context (e.g., for a Canvas instance)
   * @param contextId - Unique identifier for this context
   * @returns Initial identity transform matrix
   */
  static createContext(contextId: string): Float32Array {
    if (this.transformStacks.has(contextId)) {
      this.logger.warn(`Transform context '${contextId}' already exists`);
    }
    
    this.transformStacks.set(contextId, []);
    const identityMatrix = Matrix.createIdentity();
    this.currentTransforms.set(contextId, identityMatrix);
    
    // Initialize inverse transform (identity matrix is its own inverse)
    const identityInverse = Matrix.createIdentity();
    this.currentInverseTransforms.set(contextId, identityInverse);
    this.inverseTransformsDirty.set(contextId, false);
    
    return identityMatrix;
  }
  
  /**
   * Destroy a transform context and clean up its resources
   * @param contextId - Context identifier to destroy
   */
  static destroyContext(contextId: string): void {
    const stack = this.transformStacks.get(contextId);
    if (stack) {
      // Return all matrices from this context's stack to the pool
      while (stack.length > 0) {
        const matrix = stack.pop()!;
        this.returnMatrixToPool(matrix);
      }
    }
    
    this.transformStacks.delete(contextId);
    this.currentTransforms.delete(contextId);
    this.currentInverseTransforms.delete(contextId);
    this.inverseTransformsDirty.delete(contextId);
  }
  
  /**
   * Get a matrix from the pool or create a new one if pool is empty
   * @returns A Float32Array matrix ready for use
   */
  private static getMatrixFromPool(): Float32Array {
    const matrix = this.matrixPool.pop();
    if (matrix) {
      this.poolHits++;
      return matrix;
    } else {
      this.poolMisses++;
      this.totalAllocations++;
      this.logger.warn("Transform matrix pool exhausted, creating new matrix");
      return new Float32Array(16);
    }
  }
  
  /**
   * Return a matrix to the pool for reuse
   * @param matrix - Matrix to return to pool
   */
  private static returnMatrixToPool(matrix: Float32Array): void {
    if (this.matrixPool.length < this.DEFAULT_POOL_SIZE * 2) {
      this.matrixPool.push(matrix);
    }
    // If pool is too large, let the matrix be garbage collected
  }
  
  /**
   * Mark the inverse transform as dirty for the given context
   * @param contextId - Context identifier
   */
  private static markInverseDirty(contextId: string): void {
    this.inverseTransformsDirty.set(contextId, true);
  }
  
  /**
   * Push current transform onto the stack for the given context
   * @param contextId - Context identifier
   */
  static pushTransform(contextId: string): void {
    const stack = this.transformStacks.get(contextId);
    const currentTransform = this.currentTransforms.get(contextId);
    
    if (!stack || !currentTransform) {
      this.logger.error(`Transform context '${contextId}' not found`);
      return;
    }
    
    if (stack.length >= this.MAX_STACK_DEPTH) {
      this.logger.warn(
        `Transform stack depth limit reached (${this.MAX_STACK_DEPTH}) for context '${contextId}'`,
        Color.fromHex("#FFAA00")
      );
      return;
    }
    
    // Get matrix from pool and copy current transform
    const matrix = this.getMatrixFromPool();
    matrix.set(currentTransform);
    stack.push(matrix);
    
    // Update monitoring
    this.maxObservedStackDepth = Math.max(this.maxObservedStackDepth, stack.length);
  }
  
  /**
   * Pop transform from the stack for the given context
   * @param contextId - Context identifier
   * @returns True if successful, false if stack was empty
   */
  static popTransform(contextId: string): boolean {
    const stack = this.transformStacks.get(contextId);
    const currentTransform = this.currentTransforms.get(contextId);
    
    if (!stack || !currentTransform) {
      this.logger.error(`Transform context '${contextId}' not found`);
      return false;
    }
    
    if (stack.length === 0) {
      this.logger.warn(
        `Transform stack is empty for context '${contextId}' - cannot pop`,
        Color.fromHex("#FFAA00")
      );
      return false;
    }
    
    const matrix = stack.pop()!;
    currentTransform.set(matrix);
    this.returnMatrixToPool(matrix);
    
    // Mark inverse as dirty since transform changed
    this.markInverseDirty(contextId);
    
    return true;
  }
  
  /**
   * Reset transform to identity matrix for the given context
   * @param contextId - Context identifier
   */
  static resetTransform(contextId: string): void {
    const currentTransform = this.currentTransforms.get(contextId);
    const currentInverse = this.currentInverseTransforms.get(contextId);
    if (!currentTransform || !currentInverse) {
      this.logger.error(`Transform context '${contextId}' not found`);
      return;
    }
    
    Matrix.setIdentity(currentTransform);
    Matrix.setIdentity(currentInverse);
    this.inverseTransformsDirty.set(contextId, false);
  }
  
  /**
   * Apply translation to the current transform
   * @param contextId - Context identifier
   * @param x - X translation
   * @param y - Y translation
   */
  static translate(contextId: string, x: number, y: number): void {
    if (x === 0 && y === 0) return; // Optimize for no-op
    
    const currentTransform = this.currentTransforms.get(contextId);
    if (!currentTransform) {
      this.logger.error(`Transform context '${contextId}' not found`);
      return;
    }
    
    const tempMatrix1 = Matrix.getTempMatrix1();
    const tempMatrix2 = Matrix.getTempMatrix2();
    
    Matrix.setTranslation(tempMatrix1, x, y);
    Matrix.multiplyInPlace(currentTransform, tempMatrix1, tempMatrix2);
    
    // Copy result back to current transform
    currentTransform.set(tempMatrix2);
    
    // Mark inverse as dirty since transform changed
    this.markInverseDirty(contextId);
  }
  
  /**
   * Apply scaling to the current transform
   * @param contextId - Context identifier
   * @param x - X scale factor
   * @param y - Y scale factor
   */
  static scale(contextId: string, x: number, y: number): void {
    if (x === 1 && y === 1) return; // Optimize for no-op
    
    const currentTransform = this.currentTransforms.get(contextId);
    if (!currentTransform) {
      this.logger.error(`Transform context '${contextId}' not found`);
      return;
    }
    
    const tempMatrix1 = Matrix.getTempMatrix1();
    const tempMatrix2 = Matrix.getTempMatrix2();
    
    Matrix.setScale(tempMatrix1, x, y);
    Matrix.multiplyInPlace(currentTransform, tempMatrix1, tempMatrix2);
    
    // Copy result back to current transform
    currentTransform.set(tempMatrix2);
    
    // Mark inverse as dirty since transform changed
    this.markInverseDirty(contextId);
  }
  
  /**
   * Apply rotation to the current transform
   * @param contextId - Context identifier
   * @param angle - Rotation angle in radians
   */
  static rotate(contextId: string, angle: number): void {
    if (angle === 0) return; // Optimize for no-op
    
    const currentTransform = this.currentTransforms.get(contextId);
    if (!currentTransform) {
      this.logger.error(`Transform context '${contextId}' not found`);
      return;
    }
    
    const tempMatrix1 = Matrix.getTempMatrix1();
    const tempMatrix2 = Matrix.getTempMatrix2();
    
    Matrix.setRotationZ(tempMatrix1, angle);
    Matrix.multiplyInPlace(currentTransform, tempMatrix1, tempMatrix2);
    
    // Copy result back to current transform
    currentTransform.set(tempMatrix2);
    
    // Mark inverse as dirty since transform changed
    this.markInverseDirty(contextId);
  }
  
  /**
   * Get the current transform matrix for a context
   * @param contextId - Context identifier
   * @returns Current transform matrix or null if context not found
   */
  static getCurrentTransform(contextId: string): Float32Array | null {
    return this.currentTransforms.get(contextId) || null;
  }

  /**
   * Get the current inverse transform matrix for a context
   * @param contextId - Context identifier
   * @returns Current inverse transform matrix or null if context not found or matrix not invertible
   */
  static getCurrentTransformInverse(contextId: string): Float32Array | null {
    const currentTransform = this.currentTransforms.get(contextId);
    const currentInverse = this.currentInverseTransforms.get(contextId);
    const isDirty = this.inverseTransformsDirty.get(contextId);
    
    if (!currentTransform || !currentInverse) {
      return null;
    }
    
    // Update inverse transform if it's dirty
    if (isDirty) {
      if (Matrix.setInverse(currentInverse, currentTransform)) {
        this.inverseTransformsDirty.set(contextId, false);
      } else {
        // Matrix is not invertible
        return null;
      }
    }
    
    return currentInverse;
  }
  
  /**
   * Clear the transform stack for a context (useful for frame cleanup)
   * @param contextId - Context identifier
   */
  static clearStack(contextId: string): void {
    const stack = this.transformStacks.get(contextId);
    if (!stack) {
      this.logger.error(`Transform context '${contextId}' not found`);
      return;
    }
    
    if (stack.length > 0) {
      this.logger.warn(
        `Clearing non-empty transform stack for context '${contextId}' (${stack.length} items)`,
        Color.fromHex("#FFAA00")
      );
      
      // Return all matrices to pool
      while (stack.length > 0) {
        const matrix = stack.pop()!;
        this.returnMatrixToPool(matrix);
      }
    }
  }
  
  /**
   * Execute a function with a temporary transform scope
   * @param contextId - Context identifier
   * @param operation - Function to execute within the transform scope
   * @returns The result of the operation
   */
  static withTransform<T>(contextId: string, operation: () => T): T {
    this.pushTransform(contextId);
    try {
      return operation();
    } finally {
      this.popTransform(contextId);
    }
  }
  
  /**
   * Get performance and usage statistics
   * @returns Statistics object
   */
  static getStats(): {
    poolSize: number;
    totalAllocations: number;
    poolHits: number;
    poolMisses: number;
    poolHitRate: number;
    maxObservedStackDepth: number;
    activeContexts: number;
  } {
    const totalQueries = this.poolHits + this.poolMisses;
    return {
      poolSize: this.matrixPool.length,
      totalAllocations: this.totalAllocations,
      poolHits: this.poolHits,
      poolMisses: this.poolMisses,
      poolHitRate: totalQueries > 0 ? (this.poolHits / totalQueries) * 100 : 0,
      maxObservedStackDepth: this.maxObservedStackDepth,
      activeContexts: this.transformStacks.size,
    };
  }
  
  /**
   * Clear all statistics (useful for testing or profiling)
   */
  static clearStats(): void {
    this.maxObservedStackDepth = 0;
    this.poolHits = 0;
    this.poolMisses = 0;
    // Keep totalAllocations for lifetime tracking
  }
  
  /**
   * Clean up all resources and reset the Transform system
   */
  static cleanup(): void {
    // Clear all contexts
    for (const contextId of this.transformStacks.keys()) {
      this.destroyContext(contextId);
    }
    
    // Clear pool and statistics
    this.matrixPool.length = 0;
    this.clearStats();
    this.totalAllocations = 0;
    
    this.logger.info("Transform system cleaned up");
  }
}