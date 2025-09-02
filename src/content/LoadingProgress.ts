// LoadingProgress.ts - Unified loading progress tracking types

export interface LoadingProgress {
  bundleName: string;
  totalAssets: number;
  loadedAssets: number;
  currentAsset?: string;
  percentage: number;
  isComplete: boolean;
}

export interface AssetLoadProgress {
  completed: number;
  currentAsset: string;
}
