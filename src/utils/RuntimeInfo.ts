// RuntimeInfo.ts - Centralized runtime environment information

/**
 * Centralized runtime environment information
 * Provides efficient access to environment flags without repeated checks
 */
export class RuntimeInfo {
  private static instance: RuntimeInfo | null = null;
  
  // Environment flags - computed once at startup
  private readonly _isDevelopment: boolean;
  private readonly _isProduction: boolean;
  private readonly _isTest: boolean;
  private readonly _nodeEnv: string;
  
  // Performance flags
  private readonly _enableDebugLogging: boolean;
  private readonly _enablePerfTracking: boolean;
  private readonly _enableErrorTracking: boolean;
  
  private constructor() {
    // Determine environment once at startup using modern best practices
    // Priority: import.meta.env (modern) -> process.env (traditional) -> default
    let nodeEnv = 'development'; // Safe default
    
    try {
      // Modern approach: import.meta.env (Vite, modern bundlers)
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        if (import.meta.env.PROD) {
          nodeEnv = 'production';
        } else if (import.meta.env.DEV) {
          nodeEnv = 'development';
        } else {
          nodeEnv = import.meta.env.MODE || 'development';
        }
      }
      // Traditional approach: process.env (Node.js, Webpack, CRA)
      else if (typeof globalThis !== 'undefined' && (globalThis as any).process?.env) {
        nodeEnv = (globalThis as any).process.env.NODE_ENV || 'development';
      }
    } catch (e) {
      // Fallback to development if any errors occur
      nodeEnv = 'development';
    }
    
    this._nodeEnv = nodeEnv;
    this._isDevelopment = this._nodeEnv === 'development';
    this._isProduction = this._nodeEnv === 'production';
    this._isTest = this._nodeEnv === 'test';
    
    // Configure performance flags based on environment
    this._enableDebugLogging = this._isDevelopment || this._isTest;
    this._enablePerfTracking = this._isDevelopment;
    this._enableErrorTracking = this._isDevelopment || this._isTest;
  }
  
  /**
   * Get the singleton instance
   */
  static getInstance(): RuntimeInfo {
    if (!RuntimeInfo.instance) {
      RuntimeInfo.instance = new RuntimeInfo();
    }
    return RuntimeInfo.instance;
  }
  
  /**
   * Check if running in development mode
   */
  get isDevelopment(): boolean {
    return this._isDevelopment;
  }
  
  /**
   * Check if running in production mode
   */
  get isProduction(): boolean {
    return this._isProduction;
  }
  
  /**
   * Check if running in test mode
   */
  get isTest(): boolean {
    return this._isTest;
  }
  
  /**
   * Get the current NODE_ENV value
   */
  get nodeEnv(): string {
    return this._nodeEnv;
  }
  
  /**
   * Check if debug logging should be enabled
   */
  get enableDebugLogging(): boolean {
    return this._enableDebugLogging;
  }
  
  /**
   * Check if performance tracking should be enabled
   */
  get enablePerfTracking(): boolean {
    return this._enablePerfTracking;
  }
  
  /**
   * Check if error tracking should be enabled
   */
  get enableErrorTracking(): boolean {
    return this._enableErrorTracking;
  }
  
  /**
   * Get all runtime information
   */
  getInfo(): {
    nodeEnv: string;
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
    enableDebugLogging: boolean;
    enablePerfTracking: boolean;
    enableErrorTracking: boolean;
  } {
    return {
      nodeEnv: this._nodeEnv,
      isDevelopment: this._isDevelopment,
      isProduction: this._isProduction,
      isTest: this._isTest,
      enableDebugLogging: this._enableDebugLogging,
      enablePerfTracking: this._enablePerfTracking,
      enableErrorTracking: this._enableErrorTracking
    };
  }
  
  /**
   * Check if a feature should be enabled based on environment
   * @param feature - Feature configuration
   */
  shouldEnable(feature: {
    development?: boolean;
    production?: boolean;
    test?: boolean;
  }): boolean {
    if (this._isDevelopment && feature.development !== undefined) {
      return feature.development;
    }
    if (this._isProduction && feature.production !== undefined) {
      return feature.production;
    }
    if (this._isTest && feature.test !== undefined) {
      return feature.test;
    }
    return false;
  }
}