// Content.ts - Singleton content manager for loading and managing game assets

import { Asset } from "./Asset";
import { Texture2D } from "./image/Texture2D";
import { Shader } from "./shader/Shader";
import { Font } from "./font/Font";
import { FontFactory } from "./font/FontFactory";
import { FontDefinition } from "./font/FontTypes";
import { Song } from "./audio/Song";
import { SoundEffect } from "./audio/SoundEffect";
import { AssetBundleManager } from "./AssetBundleManager";
import { LoadingProgress } from "./LoadingProgress";
import { DefaultTexture } from "./builtin/DefaultTexture";
import { AssetLoadingCoordinator } from "./AssetLoadingState";
import { logger, toast } from "../utils";

export class Content {
  private static instance: Content | null = null;
  private assets: Map<string, Asset> = new Map();
  private assetBundleManager: AssetBundleManager;
  private loadingCoordinator: AssetLoadingCoordinator;

  private constructor() {
    this.assetBundleManager = new AssetBundleManager(this);
    this.loadingCoordinator = new AssetLoadingCoordinator();
  }

  /**
   * Generic helper for race-condition-safe asset loading
   */
  private async loadAssetSafe<T extends Asset>(
    assetId: string,
    assetType: new (...args: any[]) => T,
    loadFactory: () => Promise<T>
  ): Promise<T> {
    // Check if already loaded and complete
    const existingAsset = this.assets.get(assetId);
    if (existingAsset && existingAsset instanceof assetType && existingAsset.isLoaded) {
      return existingAsset;
    }

    // Check if currently loading (race condition protection)
    if (this.loadingCoordinator.isLoading(assetId)) {
      return await this.loadingCoordinator.waitForAsset<T>(assetId);
    }

    // Check if loading previously failed
    if (this.loadingCoordinator.hasFailed(assetId)) {
      this.loadingCoordinator.clear();
    }

    const loadingPromise = loadFactory();
    const shouldLoad = this.loadingCoordinator.startLoading(assetId, loadingPromise);
    
    if (!shouldLoad) {
      return await this.loadingCoordinator.waitForAsset<T>(assetId);
    }

    return await loadingPromise;
  }

  static getInstance(): Content {
    if (!Content.instance) {
      Content.instance = new Content();
    }
    return Content.instance;
  }

  /**
   * Creates a new Texture2D asset from image data or creates an empty texture
   * @param id The asset ID
   * @param imageData Optional image data to load into the texture
   * @param width Width for empty texture (ignored if imageData provided)
   * @param height Height for empty texture (ignored if imageData provided)
   * @returns Promise that resolves to the created Texture2D
   */
  async createTexture2D(
    id: string,
    imageData?: ImageData | HTMLImageElement | ImageBitmap,
    width: number = 1,
    height: number = 1
  ): Promise<Texture2D> {
    // Check if already exists
    const existingAsset = this.assets.get(id);
    if (existingAsset && existingAsset instanceof Texture2D) {
      return existingAsset;
    }

    try {
      let texture: Texture2D;

      if (imageData) {
        // Create from provided image data
        texture = await Texture2D.fromImageData(id, imageData);
      } else {
        // Create empty texture with specified dimensions
        const emptyImageData = new ImageData(width, height);
        // Fill with transparent pixels (already initialized to 0)
        texture = await Texture2D.fromImageData(id, emptyImageData);
      }

      // Store in map after creation
      this.assets.set(id, texture);
      return texture;
    } catch (error) {
      // Remove from map if loading failed
      this.assets.delete(id);
      throw error;
    }
  }

  /**
   * Loads a Texture2D asset with race condition protection
   * @param filePath The path to the texture file
   * @param id Optional custom ID, defaults to the file path
   * @returns Promise that resolves to the loaded Texture2D
   */
  async loadTexture2D(filePath: string, id?: string): Promise<Texture2D> {
    const assetId = id || filePath;

    return await this.loadAssetSafe(assetId, Texture2D, async () => {
      const texture = new Texture2D(assetId, filePath);
      
      try {
        await texture.load();
        this.assets.set(assetId, texture);
        return texture;
      } catch (error) {
        logger.error(
          `Failed to load Texture2D from path '${filePath}' with ID '${assetId}': ${error}`
        );
        throw error;
      }
    });
  }

  /**
   * Gets an asset by ID and casts it to the specified type
   * @param id The asset ID
   * @returns The asset cast to the specified type
   * @throws Error if the asset is not found or not loaded
   */
  get<T extends Asset>(id: string): T {
    const asset = this.assets.get(id);
    if (!asset) {
      // Check if asset is currently loading
      if (this.loadingCoordinator.isLoading(id)) {
        toast.error(`Asset with ID '${id}' is still loading. Use loadXXX() methods to wait for completion.`);
        throw new Error(`Asset with ID '${id}' is still loading. Use loadXXX() methods to wait for completion.`);
      }
      
      toast.error(`Asset with ID '${id}' not found`);
      throw new Error(`Asset with ID '${id}' not found`);
    }
    
    if (!asset.isLoaded) {
      // More detailed error message about asset state
      if (this.loadingCoordinator.isLoading(id)) {
        toast.error(`Asset with ID '${id}' is still loading. Use loadXXX() methods to wait for completion.`);
        throw new Error(`Asset with ID '${id}' is still loading. Use loadXXX() methods to wait for completion.`);
      } else if (this.loadingCoordinator.hasFailed(id)) {
        toast.error(`Asset with ID '${id}' failed to load`);
        throw new Error(`Asset with ID '${id}' failed to load`);
      } else {
        toast.error(`Asset with ID '${id}' exists but is not loaded`);
        throw new Error(`Asset with ID '${id}' exists but is not loaded`);
      }
    }
    return asset as T;
  }

  /**
   * Loads a Shader asset with race condition protection
   * @param vertexPath The path to the vertex shader file (or combined shader file)
   * @param fragmentPath Optional path to the fragment shader file
   * @param id Optional custom ID, defaults to the vertex file path
   * @param shaderType Optional shader type for debugging
   * @returns Promise that resolves to the loaded Shader
   */
  async loadShader(
    vertexPath: string,
    fragmentPath?: string,
    id?: string,
    shaderType: string = "custom"
  ): Promise<Shader> {
    const assetId = id || vertexPath;

    return await this.loadAssetSafe(assetId, Shader, async () => {
      const shader = new Shader(assetId, vertexPath, fragmentPath, shaderType);
      
      try {
        await shader.load();
        this.assets.set(assetId, shader);
        return shader;
      } catch (error) {
        const pathInfo = fragmentPath
          ? `vertex: '${vertexPath}', fragment: '${fragmentPath}'`
          : `combined: '${vertexPath}'`;
        logger.error(
          `Failed to load Shader from ${pathInfo} with ID '${assetId}': ${error}`
        );
        throw error;
      }
    });
  }

  /**
   * Gets a Texture2D asset by ID
   * @param id The texture ID
   * @returns The Texture2D asset
   * @throws Error if the texture is not found or not loaded
   */
  getTexture2D(id: string): Texture2D {
    return this.get<Texture2D>(id);
  }

  /**
   * Gets the default engine logo texture
   * @returns Promise that resolves to the default Texture2D
   */
  async getDefaultTexture(): Promise<Texture2D> {
    const defaultId = "default-texture";
    
    // Check if already loaded
    const existingAsset = this.assets.get(defaultId);
    if (existingAsset && existingAsset instanceof Texture2D) {
      return existingAsset;
    }

    // Create and store the default texture
    const defaultTexture = await DefaultTexture.getInstance();
    this.assets.set(defaultId, defaultTexture);
    
    return defaultTexture;
  }

  /**
   * Gets a Shader asset by ID
   * @param id The shader ID
   * @returns The Shader asset
   * @throws Error if the shader is not found or not loaded
   */
  getShader(id: string): Shader {
    return this.get<Shader>(id);
  }

  /**
   * Loads a Font asset with race condition protection
   * @param id The font asset ID
   * @param definition The font definition
   * @returns Promise that resolves to the loaded Font
   */
  async loadFont(id: string, definition: FontDefinition): Promise<Font> {
    return await this.loadAssetSafe(id, Font, async () => {
      // Validate font definition
      if (!FontFactory.validateDefinition(definition)) {
        throw new Error(`Invalid font definition for asset '${id}'`);
      }

      try {
        // Create new font asset (using FontFactory for file-based fonts)
        const font = await FontFactory.createFileFontFromDefinition(id, definition);

        // Store in map (font is already loaded by FontFactory)
        this.assets.set(id, font);

        logger.debug(
          `Font asset '${id}' loaded successfully (${definition.fontFamily} ${definition.fontSize}px)`
        );
        return font;
      } catch (error) {
        logger.error(
          `Failed to load Font '${id}' (${definition.fontFamily} ${definition.fontSize}px): ${error}`
        );
        throw error;
      }
    });
  }

  /**
   * Gets a Font asset by ID
   * @param id The font asset ID
   * @returns The Font asset
   * @throws Error if the font is not found or not loaded
   */
  getFont(id: string): Font {
    return this.get<Font>(id);
  }

  /**
   * Loads a Song asset
   * @param filePath The path to the song file
   * @param id Optional custom ID, defaults to the file path
   * @param volume Optional volume (0.0 to 1.0), defaults to 1.0
   * @param loop Optional loop setting, defaults to false
   * @returns Promise that resolves to the loaded Song
   */
  async loadSong(
    filePath: string,
    id?: string,
    volume = 1.0,
    loop = false
  ): Promise<Song> {
    const assetId = id || filePath;

    return await this.loadAssetSafe(assetId, Song, async () => {
      const song = new Song(assetId, filePath, volume, loop);
      
      try {
        await song.load();
        this.assets.set(assetId, song);
        logger.debug(`Song loaded: ${assetId} (${song.getDuration().toFixed(2)}s)`);
        return song;
      } catch (error) {
        logger.error(`Failed to load Song from path '${filePath}' with ID '${assetId}': ${error}`);
        throw error;
      }
    });
  }

  /**
   * Loads a SoundEffect asset
   * @param filePath The path to the sound effect file
   * @param id Optional custom ID, defaults to the file path
   * @param volume Optional volume (0.0 to 1.0), defaults to 1.0
   * @param poolSize Optional pool size for concurrent playback, uses default if not provided
   * @returns Promise that resolves to the loaded SoundEffect
   */
  async loadSoundEffect(
    filePath: string,
    id?: string,
    volume = 1.0,
    poolSize?: number
  ): Promise<SoundEffect> {
    const assetId = id || filePath;

    return await this.loadAssetSafe(assetId, SoundEffect, async () => {
      const soundEffect = new SoundEffect(assetId, filePath, volume, poolSize);
      
      try {
        await soundEffect.load();
        this.assets.set(assetId, soundEffect);
        logger.debug(`SoundEffect loaded: ${assetId} (${soundEffect.getDuration().toFixed(2)}s)`);
        return soundEffect;
      } catch (error) {
        logger.error(`Failed to load SoundEffect from path '${filePath}' with ID '${assetId}': ${error}`);
        throw error;
      }
    });
  }

  /**
   * Gets a Song asset by ID
   * @param id The song asset ID
   * @returns The Song asset
   * @throws Error if the song is not found or not loaded
   */
  getSong(id: string): Song {
    return this.get<Song>(id);
  }

  /**
   * Gets a SoundEffect asset by ID
   * @param id The sound effect asset ID
   * @returns The SoundEffect asset
   * @throws Error if the sound effect is not found or not loaded
   */
  getSoundEffect(id: string): SoundEffect {
    return this.get<SoundEffect>(id);
  }

  /**
   * Checks if an asset is loaded
   * @param id The asset ID
   * @returns True if the asset exists and is loaded
   */
  isLoaded(id: string): boolean {
    const asset = this.assets.get(id);
    return asset ? asset.isLoaded : false;
  }

  /**
   * Unloads and disposes of an asset
   * @param id The asset ID
   * @returns True if the asset was found and disposed
   */
  unload(id: string): boolean {
    const asset = this.assets.get(id);
    if (asset) {
      asset.dispose();
      this.assets.delete(id);
      
      // Clear loading coordinator state for this asset
      this.loadingCoordinator.markDisposed(id);
      return true;
    }
    return false;
  }

  /**
   * Unloads all assets
   */
  unloadAll(): void {
    this.assets.forEach((asset) => {
      asset.dispose();
    });
    this.assets.clear();
    
    // Clear all loading coordinator state
    this.loadingCoordinator.clear();
    logger.info("All assets unloaded");
  }

  /**
   * Gets the number of loaded assets
   */
  get assetCount(): number {
    return this.assets.size;
  }

  /**
   * Gets all asset IDs
   */
  get assetIds(): string[] {
    return Array.from(this.assets.keys());
  }

  /**
   * Gets memory usage information (approximate)
   */
  getMemoryInfo(): {
    totalAssets: number;
    loadedAssets: number;
    textureAssets: number;
    shaderAssets: number;
    fontAssets: number;
    songAssets: number;
    soundEffectAssets: number;
  } {
    let loadedCount = 0;
    let textureCount = 0;
    let shaderCount = 0;
    let fontCount = 0;
    let songCount = 0;
    let soundEffectCount = 0;

    this.assets.forEach((asset) => {
      if (asset.isLoaded) {
        loadedCount++;
      }
      if (asset instanceof Texture2D) {
        textureCount++;
      }
      if (asset instanceof Shader) {
        shaderCount++;
      }
      if (asset instanceof Font) {
        fontCount++;
      }
      if (asset instanceof Song) {
        songCount++;
      }
      if (asset instanceof SoundEffect) {
        soundEffectCount++;
      }
    });

    return {
      totalAssets: this.assets.size,
      loadedAssets: loadedCount,
      textureAssets: textureCount,
      shaderAssets: shaderCount,
      fontAssets: fontCount,
      songAssets: songCount,
      soundEffectAssets: soundEffectCount,
    };
  }

  /**
   * Gets loading coordinator statistics for debugging race conditions
   */
  getLoadingStats(): {
    totalTracked: number;
    loading: number;
    loaded: number;
    failed: number;
    disposed: number;
  } {
    return this.loadingCoordinator.getStats();
  }

  /**
   * Loads a specific asset bundle by name
   * @param bundleName The name of the bundle to load
   * @param onProgress Optional progress callback for the loading process
   * @returns Promise that resolves to true if the bundle loaded successfully
   */
  async loadBundle(
    bundleName: string,
    onProgress?: (progress: LoadingProgress) => void
  ): Promise<boolean> {
    logger.info(`Loading asset bundle: ${bundleName}`);

    try {
      // Ensure bundle definitions are loaded by checking if we have any bundle names
      const bundleNames = this.assetBundleManager.getBundleNames();
      if (bundleNames.length === 0) {
        logger.info("Bundle definitions not loaded, loading them first...");
        const definitionsLoaded =
          await this.assetBundleManager.loadBundleDefinitions();
        if (!definitionsLoaded) {
          logger.error("Failed to load asset bundle definitions");
          return false;
        }
      }

      // Load the specific bundle
      const result = await this.assetBundleManager.loadBundleByName(
        bundleName,
        onProgress
      );

      if (result) {
        logger.success(`Successfully loaded bundle: ${bundleName}`);
      } else {
        logger.error(`Failed to load bundle: ${bundleName}`);
        if (import.meta.env.DEV) {
          toast.error(`Failed to load bundle: ${bundleName}`);
        }
      }

      return result;
    } catch (error) {
      logger.error(`Failed to load bundle '${bundleName}': ${error}`);
      return false;
    }
  }

  /**
   * Check if a bundle is currently loading
   * @param bundleName The name of the bundle
   * @returns True if the bundle is loading
   */
  isBundleLoading(bundleName: string): boolean {
    return this.assetBundleManager.isBundleLoading(bundleName);
  }

  /**
   * Check if a bundle has been loaded
   * @param bundleName The name of the bundle
   * @returns True if the bundle is loaded
   */
  isBundleLoaded(bundleName: string): boolean {
    return this.assetBundleManager.isBundleLoaded(bundleName);
  }

  /**
   * Get the current loading progress for a bundle
   * @param bundleName The name of the bundle
   * @returns Loading progress or null if not found
   */
  getBundleProgress(bundleName: string): LoadingProgress | null {
    return this.assetBundleManager.getBundleProgress(bundleName);
  }
}
