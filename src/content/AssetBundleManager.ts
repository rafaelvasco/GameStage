// AssetBundleManager.ts - Manages loading of asset bundles with progress tracking

import {
  AssetBundle,
  AssetDefinition,
  TextureAssetDefinition,
  FontAssetDefinition,
  SongAssetDefinition,
  SoundEffectAssetDefinition,
  LoadingProgress,
  AssetLoadProgress,
} from "./AssetBundle";
import { Content } from "./Content";
import { logger, toast } from "../utils";

interface AssetBundleDefinitions {
  bundles: Record<string, AssetBundle>;
}

export class AssetBundleManager {
  private bundles: Map<string, AssetBundle> = new Map();
  private loadingProgress: Map<string, LoadingProgress> = new Map();
  private loadingPromises: Map<string, Promise<boolean>> = new Map();
  private content: Content;
  private bundleDefinitionsLoaded: boolean = false;

  constructor(content: Content) {
    this.content = content;
  }

  /**
   * Load bundle definitions from assets.json file
   * @param assetsJsonPath Path to the assets.json file
   * @returns Promise that resolves to true if definitions were loaded successfully
   */
  async loadBundleDefinitions(
    assetsJsonPath: string = "assets/assets.json"
  ): Promise<boolean> {
    if (this.bundleDefinitionsLoaded) {
      logger.info("Bundle definitions already loaded");
      return true;
    }

    try {
      logger.info(`Loading asset bundle definitions from ${assetsJsonPath}...`);

      const response = await fetch(assetsJsonPath);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${assetsJsonPath}: ${response.status} ${response.statusText}`
        );
      }

      const data: AssetBundleDefinitions = await response.json();

      if (!data.bundles) {
        throw new Error(
          'Invalid assets.json format: missing "bundles" property'
        );
      }

      // Load all bundle definitions into the bundles map
      for (const [bundleName, bundleDefinition] of Object.entries(
        data.bundles
      )) {
        this.bundles.set(bundleName, bundleDefinition);
        logger.info(
          `Loaded bundle definition: ${bundleName} (${bundleDefinition.assets.length} assets)`
        );
      }

      this.bundleDefinitionsLoaded = true;
      logger.success(
        `Successfully loaded ${
          Object.keys(data.bundles).length
        } bundle definitions`
      );
      return true;
    } catch (error) {
      logger.error(`Failed to load bundle definitions: ${error}`);
      return false;
    }
  }

  /**
   * Load an asset bundle by name (requires bundle definitions to be loaded first)
   * @param bundleName The name of the bundle to load
   * @param onProgress Optional progress callback
   * @returns Promise that resolves to true if all assets loaded successfully
   */
  async loadBundleByName(
    bundleName: string,
    onProgress?: (progress: LoadingProgress) => void
  ): Promise<boolean> {
    if (!this.bundleDefinitionsLoaded) {
      logger.warn(
        "Bundle definitions not loaded. Call loadBundleDefinitions() first."
      );
      return false;
    }

    const bundle = this.bundles.get(bundleName);
    if (!bundle) {
      logger.error(`Bundle '${bundleName}' not found in definitions`);
      if (import.meta.env.DEV) {
        toast.error(`Bundle '${bundleName}' not found in definitions`);
      }
      return false;
    }

    return this.loadBundle(bundle, onProgress);
  }

  /**
   * Load an asset bundle with progress tracking
   * @param bundle The asset bundle to load
   * @param onProgress Optional progress callback
   * @returns Promise that resolves to true if all assets loaded successfully
   */
  async loadBundle(
    bundle: AssetBundle,
    onProgress?: (progress: LoadingProgress) => void
  ): Promise<boolean> {
    // Check if already loading
    if (this.loadingPromises.has(bundle.name)) {
      return this.loadingPromises.get(bundle.name)!;
    }

    const progress: LoadingProgress = {
      bundleName: bundle.name,
      totalAssets: bundle.assets.length,
      loadedAssets: 0,
      percentage: 0,
      isComplete: false,
    };

    this.loadingProgress.set(bundle.name, progress);
    this.bundles.set(bundle.name, bundle);

    // Create loading promise
    const loadingPromise = this.loadBundleInternal(
      bundle,
      progress,
      onProgress
    );
    this.loadingPromises.set(bundle.name, loadingPromise);

    try {
      const result = await loadingPromise;
      progress.isComplete = true;
      progress.percentage = 100;

      if (onProgress) onProgress(progress);

      return result;
    } finally {
      this.loadingPromises.delete(bundle.name);
    }
  }

  /**
   * Load an asset bundle in the background (non-blocking)
   * @param bundleName The name of the bundle to load
   */
  async loadBundleAsync(bundleName: string): Promise<void> {
    if (!this.bundleDefinitionsLoaded) {
      logger.warn(
        "Bundle definitions not loaded. Call loadBundleDefinitions() first."
      );
      return;
    }

    const bundle = this.bundles.get(bundleName);
    if (!bundle) {
      logger.warn(`Bundle '${bundleName}' not found for async loading`);
      return;
    }

    try {
      await this.loadBundle(bundle);
      logger.info(`Background loading completed for bundle: ${bundleName}`);
    } catch (error) {
      logger.warn(
        `Background loading failed for bundle '${bundleName}': ${error}`
      );
    }
  }

  /**
   * Get the current loading progress for a bundle
   * @param bundleName The name of the bundle
   * @returns Loading progress or null if not found
   */
  getBundleProgress(bundleName: string): LoadingProgress | null {
    return this.loadingProgress.get(bundleName) || null;
  }

  /**
   * Check if a bundle is currently loading
   * @param bundleName The name of the bundle
   * @returns True if the bundle is loading
   */
  isBundleLoading(bundleName: string): boolean {
    return this.loadingPromises.has(bundleName);
  }

  /**
   * Check if a bundle has been loaded
   * @param bundleName The name of the bundle
   * @returns True if the bundle is loaded
   */
  isBundleLoaded(bundleName: string): boolean {
    const progress = this.loadingProgress.get(bundleName);
    return progress ? progress.isComplete : false;
  }

  private async loadBundleInternal(
    bundle: AssetBundle,
    progress: LoadingProgress,
    onProgress?: (progress: LoadingProgress) => void
  ): Promise<boolean> {
    logger.info(
      `Loading asset bundle: ${bundle.name} (${bundle.assets.length} assets)`
    );

    // Load assets in parallel with concurrency limit
    const concurrencyLimit = 4;
    const results = await this.loadAssetsWithConcurrency(
      bundle.assets,
      concurrencyLimit,
      (assetProgress) => {
        progress.loadedAssets = assetProgress.completed;
        progress.percentage =
          progress.totalAssets > 0
            ? (progress.loadedAssets / progress.totalAssets) * 100
            : 100;
        progress.currentAsset = assetProgress.currentAsset;

        if (onProgress) onProgress(progress);
      }
    );

    const allLoaded = results.every((result) => result);

    if (allLoaded) {
      logger.info(`Successfully loaded bundle: ${bundle.name}`);
    } else {
      logger.warn(`Some assets failed to load in bundle: ${bundle.name}`);
    }

    return allLoaded;
  }

  private async loadAssetsWithConcurrency(
    assets: AssetDefinition[],
    limit: number,
    onProgress: (progress: AssetLoadProgress) => void
  ): Promise<boolean[]> {
    let completed = 0;
    const results: boolean[] = new Array(assets.length);

    // Create semaphore for concurrency control
    const semaphore: Promise<void>[] = new Array(limit).fill(Promise.resolve());
    let semaphoreIndex = 0;

    const loadAsset = async (
      asset: AssetDefinition,
      index: number
    ): Promise<boolean> => {
      try {
        // Wait for available slot
        await semaphore[semaphoreIndex];
        const currentSlot = semaphoreIndex;
        semaphoreIndex = (semaphoreIndex + 1) % limit;

        onProgress({ completed, currentAsset: asset.id });

        let success = false;

        // Load based on asset type
        switch (asset.type) {
          case "texture": {
            const textureAsset = asset as TextureAssetDefinition;
            try {
              await this.content.loadTexture2D(
                textureAsset.path,
                textureAsset.id
              );
              success = this.content.isLoaded(textureAsset.id);
            } catch (error) {
              logger.error(
                `Failed to load texture asset '${textureAsset.id}' from path '${textureAsset.path}': ${error}`
              );
              success = false;
            }
            break;
          }
          case "font": {
            const fontAsset = asset as FontAssetDefinition;
            try {
              await this.content.loadFont(fontAsset.id, fontAsset.font);
              success = this.content.isLoaded(fontAsset.id);
            } catch (error) {
              logger.error(
                `Failed to load font asset '${fontAsset.id}': ${error}`
              );
              success = false;
            }
            break;
          }
          case "song": {
            const songAsset = asset as SongAssetDefinition;
            try {
              await this.content.loadSong(
                songAsset.path,
                songAsset.id,
                songAsset.volume,
                songAsset.loop
              );
              success = this.content.isLoaded(songAsset.id);
            } catch (error) {
              logger.error(
                `Failed to load song asset '${songAsset.id}' from path '${songAsset.path}': ${error}`
              );
              success = false;
            }
            break;
          }
          case "soundeffect": {
            const soundEffectAsset = asset as SoundEffectAssetDefinition;
            try {
              await this.content.loadSoundEffect(
                soundEffectAsset.path,
                soundEffectAsset.id,
                soundEffectAsset.volume,
                soundEffectAsset.poolSize
              );
              success = this.content.isLoaded(soundEffectAsset.id);
            } catch (error) {
              logger.error(
                `Failed to load sound effect asset '${soundEffectAsset.id}' from path '${soundEffectAsset.path}': ${error}`
              );
              success = false;
            }
            break;
          }
          case "shader":
            // TODO: Implement shader loading
            logger.warn(
              `Shader loading not yet implemented for asset '${asset.id}'`
            );
            success = false;
            break;
          default: {
            // TypeScript exhaustiveness check - this should never happen if all cases are handled
            const exhaustiveCheck: never = asset;
            logger.error(
              `Unknown asset type for asset '${(exhaustiveCheck as any).id}'`
            );
            success = false;
          }
        }

        completed++;
        onProgress({ completed, currentAsset: asset.id });

        // Release semaphore slot
        semaphore[currentSlot] = Promise.resolve();

        results[index] = success;
        return success;
      } catch (error) {
        const assetInfo =
          asset.type === "font"
            ? `'${asset.id}' (font: ${
                (asset as FontAssetDefinition).font.fontFamily
              })`
            : asset.type === "texture"
            ? `'${asset.id}' from path '${
                (asset as TextureAssetDefinition).path
              }'`
            : `'${asset.id}'`;

        logger.error(
          `Critical error loading ${asset.type} asset ${assetInfo}: ${error}`
        );

        completed++;
        onProgress({ completed, currentAsset: asset.id });

        results[index] = false;
        return false;
      }
    };

    // Start all asset loads
    const promises = assets.map((asset, index) => loadAsset(asset, index));
    await Promise.all(promises);

    return results;
  }

  /**
   * Clear all loading progress data
   */
  clearProgress(): void {
    this.loadingProgress.clear();
  }

  /**
   * Get all bundle names
   */
  getBundleNames(): string[] {
    return Array.from(this.bundles.keys());
  }
}
