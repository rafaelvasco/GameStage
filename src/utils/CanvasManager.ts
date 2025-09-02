export interface CanvasContextConfig {
  willReadFrequently?: boolean;
  alpha?: boolean;
  desynchronized?: boolean;
  imageSmoothingEnabled?: boolean;
  imageRendering?: 'auto' | 'crisp-edges' | 'pixelated';
}

export interface PooledCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  inUse: boolean;
}

export class CanvasManager {
  private static instance: CanvasManager;
  
  private canvasPool: PooledCanvas[] = [];
  private readonly maxPoolSize = 5;
  
  // Predefined context configurations
  static readonly BITMAP_CONFIG: CanvasContextConfig = {
    willReadFrequently: true,
    alpha: true,
    desynchronized: true,
    imageSmoothingEnabled: false,
    imageRendering: 'crisp-edges'
  };
  
  static readonly FONT_CONFIG: CanvasContextConfig = {
    willReadFrequently: true,
    alpha: true,
    imageSmoothingEnabled: true,
    imageRendering: 'auto'
  };
  
  static readonly SCALING_CONFIG: CanvasContextConfig = {
    willReadFrequently: false,
    alpha: true,
    imageSmoothingEnabled: false,
    imageRendering: 'crisp-edges'
  };

  private constructor() {}

  static getInstance(): CanvasManager {
    if (!CanvasManager.instance) {
      CanvasManager.instance = new CanvasManager();
    }
    return CanvasManager.instance;
  }

  /**
   * Create a new canvas with specified configuration
   */
  createCanvas(width: number, height: number, config?: CanvasContextConfig): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    if (config?.imageRendering) {
      canvas.style.imageRendering = config.imageRendering;
    }
    
    const ctx = canvas.getContext('2d', {
      willReadFrequently: config?.willReadFrequently ?? false,
      alpha: config?.alpha ?? true,
      desynchronized: config?.desynchronized ?? false
    })!;
    
    if (config?.imageSmoothingEnabled !== undefined) {
      ctx.imageSmoothingEnabled = config.imageSmoothingEnabled;
    }
    
    return { canvas, ctx };
  }

  /**
   * Rent a canvas from the pool for temporary operations
   */
  rentCanvas(minWidth: number, minHeight: number, config?: CanvasContextConfig): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; dispose: () => void } {
    // Try to find an available canvas that's large enough
    let pooledCanvas = this.canvasPool.find(pc => 
      !pc.inUse && pc.width >= minWidth && pc.height >= minHeight
    );
    
    if (!pooledCanvas) {
      // Try to find any available canvas and resize it
      pooledCanvas = this.canvasPool.find(pc => !pc.inUse);
      
      if (pooledCanvas) {
        // Resize existing canvas
        pooledCanvas.canvas.width = minWidth;
        pooledCanvas.canvas.height = minHeight;
        pooledCanvas.width = minWidth;
        pooledCanvas.height = minHeight;
      } else if (this.canvasPool.length < this.maxPoolSize) {
        // Create new pooled canvas
        const { canvas, ctx } = this.createCanvas(minWidth, minHeight, config);
        pooledCanvas = {
          canvas,
          ctx,
          width: minWidth,
          height: minHeight,
          inUse: false
        };
        this.canvasPool.push(pooledCanvas);
      } else {
        // Pool is full, create temporary canvas
        const { canvas, ctx } = this.createCanvas(minWidth, minHeight, config);
        return {
          canvas,
          ctx,
          dispose: () => {
            // No-op for temporary canvas - will be garbage collected
          }
        };
      }
    }
    
    // Mark as in use and apply configuration
    pooledCanvas.inUse = true;
    
    if (config) {
      if (config.imageSmoothingEnabled !== undefined) {
        pooledCanvas.ctx.imageSmoothingEnabled = config.imageSmoothingEnabled;
      }
      if (config.imageRendering) {
        pooledCanvas.canvas.style.imageRendering = config.imageRendering;
      }
    }
    
    // Clear the canvas
    pooledCanvas.ctx.clearRect(0, 0, pooledCanvas.width, pooledCanvas.height);
    
    return {
      canvas: pooledCanvas.canvas,
      ctx: pooledCanvas.ctx,
      dispose: () => {
        pooledCanvas!.inUse = false;
      }
    };
  }

  /**
   * Create the main application canvas (for Canvas.ts)
   */
  createMainCanvas(width: number, height: number, id: string = 'app-canvas'): { canvas: HTMLCanvasElement; ctx?: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.imageRendering = 'pixelated';
    canvas.id = id;
    
    return { canvas };
  }

  /**
   * Create a shared canvas for specific purposes (like Bitmap operations)
   */
  createSharedCanvas(config: CanvasContextConfig): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    return this.createCanvas(1, 1, config);
  }

  /**
   * Get pool statistics for debugging
   */
  getPoolStats(): { totalCanvases: number; inUse: number; available: number } {
    const inUse = this.canvasPool.filter(pc => pc.inUse).length;
    return {
      totalCanvases: this.canvasPool.length,
      inUse,
      available: this.canvasPool.length - inUse
    };
  }

  /**
   * Clean up unused canvases from the pool
   */
  cleanup(): void {
    this.canvasPool = this.canvasPool.filter(pc => pc.inUse);
  }

  /**
   * Clear all canvases from the pool
   */
  dispose(): void {
    this.canvasPool.length = 0;
  }
}