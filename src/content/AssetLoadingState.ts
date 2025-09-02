// AssetLoadingState.ts - Advanced asset loading state management with race condition prevention

/**
 * Possible states for an asset during its lifecycle
 */
export enum AssetState {
  /** Asset has not started loading */
  Idle = "idle",
  /** Asset is currently loading */
  Loading = "loading", 
  /** Asset has loaded successfully */
  Loaded = "loaded",
  /** Asset failed to load */
  Failed = "failed",
  /** Asset is being disposed */
  Disposing = "disposing",
  /** Asset has been disposed */
  Disposed = "disposed"
}

/**
 * Information about an asset's loading progress and state
 */
export interface AssetLoadingInfo {
  /** Current state of the asset */
  state: AssetState;
  /** Loading promise for coordination between concurrent requests */
  loadingPromise: Promise<any> | null;
  /** Error information if loading failed */
  error: Error | null;
  /** Timestamp when loading started */
  loadStartTime: number;
  /** Number of concurrent requests waiting for this asset */
  pendingRequestCount: number;
}

/**
 * Advanced asset loading coordinator to prevent race conditions and manage concurrent access
 */
export class AssetLoadingCoordinator {
  private loadingStates: Map<string, AssetLoadingInfo> = new Map();

  /**
   * Check if an asset is currently loading
   */
  isLoading(assetId: string): boolean {
    const info = this.loadingStates.get(assetId);
    return info?.state === AssetState.Loading;
  }

  /**
   * Check if an asset has completed loading successfully
   */
  isLoaded(assetId: string): boolean {
    const info = this.loadingStates.get(assetId);
    return info?.state === AssetState.Loaded;
  }

  /**
   * Check if an asset loading failed
   */
  hasFailed(assetId: string): boolean {
    const info = this.loadingStates.get(assetId);
    return info?.state === AssetState.Failed;
  }

  /**
   * Get the current loading promise for an asset (if loading)
   */
  getLoadingPromise<T>(assetId: string): Promise<T> | null {
    const info = this.loadingStates.get(assetId);
    return info?.loadingPromise as Promise<T> || null;
  }

  /**
   * Start tracking a new asset loading operation
   * Returns false if already loading (race condition detected)
   */
  startLoading<T>(assetId: string, loadingPromise: Promise<T>): boolean {
    const existingInfo = this.loadingStates.get(assetId);

    // If already loading, increment pending count and return false
    if (existingInfo?.state === AssetState.Loading) {
      existingInfo.pendingRequestCount++;
      return false;
    }

    // If loaded successfully, no need to reload
    if (existingInfo?.state === AssetState.Loaded) {
      return false;
    }

    // Start new loading operation
    const loadingInfo: AssetLoadingInfo = {
      state: AssetState.Loading,
      loadingPromise,
      error: null,
      loadStartTime: performance.now(),
      pendingRequestCount: 1
    };

    this.loadingStates.set(assetId, loadingInfo);

    // Set up promise completion handlers
    loadingPromise
      .then(() => {
        const info = this.loadingStates.get(assetId);
        if (info) {
          info.state = AssetState.Loaded;
          info.loadingPromise = null;
          info.error = null;
        }
      })
      .catch((error) => {
        const info = this.loadingStates.get(assetId);
        if (info) {
          info.state = AssetState.Failed;
          info.loadingPromise = null;
          info.error = error;
        }
      });

    return true;
  }

  /**
   * Wait for an asset to finish loading (for concurrent requests)
   */
  async waitForAsset<T>(assetId: string): Promise<T> {
    const info = this.loadingStates.get(assetId);
    if (!info) {
      throw new Error(`Asset '${assetId}' is not being tracked`);
    }

    if (info.state === AssetState.Loaded) {
      return info.loadingPromise as T; // Already loaded
    }

    if (info.state === AssetState.Failed) {
      throw info.error || new Error(`Asset '${assetId}' failed to load`);
    }

    if (info.state === AssetState.Loading && info.loadingPromise) {
      // Wait for the loading to complete
      try {
        const result = await info.loadingPromise;
        return result as T;
      } finally {
        // Decrement pending count
        info.pendingRequestCount = Math.max(0, info.pendingRequestCount - 1);
      }
    }

    throw new Error(`Asset '${assetId}' is in unexpected state: ${info.state}`);
  }

  /**
   * Mark an asset as disposed and clean up tracking
   */
  markDisposed(assetId: string): void {
    const info = this.loadingStates.get(assetId);
    if (info) {
      info.state = AssetState.Disposed;
      
      // Clean up if no pending requests
      if (info.pendingRequestCount <= 0) {
        this.loadingStates.delete(assetId);
      }
    }
  }

  /**
   * Clear all loading state (useful for testing or reset scenarios)
   */
  clear(): void {
    this.loadingStates.clear();
  }

  /**
   * Get loading statistics for debugging
   */
  getStats(): {
    totalTracked: number;
    loading: number;
    loaded: number;
    failed: number;
    disposed: number;
  } {
    let loading = 0, loaded = 0, failed = 0, disposed = 0;
    
    for (const info of this.loadingStates.values()) {
      switch (info.state) {
        case AssetState.Loading: loading++; break;
        case AssetState.Loaded: loaded++; break;
        case AssetState.Failed: failed++; break;
        case AssetState.Disposed: disposed++; break;
      }
    }

    return {
      totalTracked: this.loadingStates.size,
      loading,
      loaded,
      failed,
      disposed
    };
  }
}