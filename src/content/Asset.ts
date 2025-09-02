// Asset.ts - Abstract base class for all game assets

export abstract class Asset {
  protected _id: string;
  protected _filePath: string | null;

  constructor(id: string, filePath: string | null = null) {
    this._id = id;
    this._filePath = filePath;
  }

  get id(): string {
    return this._id;
  }

  get filePath(): string | null {
    return this._filePath;
  }

  /**
   * Abstract method to load the asset
   * Must be implemented by concrete asset classes
   */
  abstract load(): Promise<void>;

  /**
   * Abstract method to dispose of the asset
   * Must be implemented by concrete asset classes
   */
  abstract dispose(): void;

  /**
   * Check if the asset is loaded
   */
  abstract get isLoaded(): boolean;
}
