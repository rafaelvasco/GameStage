/**
 * ImageLoader - Singleton for loading images
 * Centralizes image loading functionality that was duplicated across graphics implementations
 */
import { logger } from "../../utils";

export class ImageLoader {
  private static instance: ImageLoader | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of ImageLoader
   */
  static getInstance(): ImageLoader {
    if (!ImageLoader.instance) {
      ImageLoader.instance = new ImageLoader();
    }
    return ImageLoader.instance;
  }

  /**
   * Load an image from a URL
   * @param url - The URL of the image to load
   * @returns Promise that resolves to the loaded HTMLImageElement
   */
  async loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        logger.debug(`Successfully loaded image from URL: ${url}`);
        resolve(img);
      };
      img.onerror = () => {
        const errorMsg = `Failed to load image from URL: ${url}`;
        logger.error(errorMsg);
        reject(new Error(errorMsg));
      };
      img.src = url;
    });
  }
}
