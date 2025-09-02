import { Scene } from "./Scene";
import { Canvas, Color } from "../graphics";
import { Content, Song, SoundEffect } from "../content";
import { AudioContext } from "../audio/AudioContext";
import { Logger } from "../utils/Logger";

/**
 * AudioTestScene - Test scene for audio system functionality
 *
 * Demonstrates loading and playing songs and sound effects with
 * interactive controls and visual feedback.
 */
export class AudioTestScene extends Scene {
  private logger = Logger.getInstance();
  private audioContext = AudioContext.getInstance();

  private backgroundMusic: Song | null = null;
  private buttonClick: SoundEffect | null = null;
  private jumpSound: SoundEffect | null = null;

  private assetsLoaded = false;
  private lastKeyTime = 0;
  private instructions: string[] = [];
  private status: string[] = [];
  private keydownHandler: ((event: KeyboardEvent) => Promise<void>) | null =
    null;

  constructor(canvas: Canvas, content: Content) {
    super(canvas, content);

    this.instructions = [
      "Audio Test Scene",
      "",
      "Controls:",
      "1 - Play/Pause Background Music",
      "2 - Play Button Click Sound",
      "3 - Play Jump Sound (with pitch variation)",
      "4 - Stop All Audio (resets position)",
      "5 - Toggle Master Volume (Full/Half)",
      "6 - Toggle Music Volume (Full/Half)",
      "7 - Toggle SFX Volume (Full/Half)",
      "8 - Test Rapid Sound Effect Pooling",
      "Up Key - Increase Master Volume (+10%)",
      "Down Key - Decrease Master Volume (-10%)",
      "",
      "Status:",
    ];
  }

  async initialize(): Promise<boolean> {
    this.logger.info("Initializing AudioTestScene...");

    try {
      // Load audio assets
      this.logger.info("Loading audio-test bundle...");
      const bundleLoaded = await this.content.loadBundle("audio-test");

      if (bundleLoaded) {
        this.backgroundMusic = this.content.getSong("background-music");
        this.buttonClick = this.content.getSoundEffect("button-click");
        this.jumpSound = this.content.getSoundEffect("jump-sound");

        this.assetsLoaded = true;
        this.logger.info("Audio assets loaded successfully");
        this.updateStatus();
        this.setupInputListeners();
        return true;
      } else {
        this.logger.error("Failed to load audio-test bundle");
        this.status.push("ERROR: Failed to load audio assets");
        this.updateStatus();
        return false;
      }
    } catch (error) {
      this.logger.error(`Error loading audio assets: ${error}`);
      this.status.push(`ERROR: ${error}`);
      this.updateStatus();
      return false;
    }
  }

  private updateStatus(): void {
    this.status = [];

    // Audio context status
    this.status.push(
      `Audio Context: ${
        this.audioContext.initialized ? "Initialized" : "Not Initialized"
      }`
    );
    this.status.push(`Audio State: ${this.audioContext.state || "Unknown"}`);
    this.status.push(
      `Audio Suspended: ${this.audioContext.suspended ? "Yes" : "No"}`
    );

    if (this.audioContext.initialized) {
      this.status.push(
        `Master Volume: ${(this.audioContext.getMasterVolume() * 100).toFixed(
          0
        )}%`
      );
      this.status.push(
        `Music Volume: ${(this.audioContext.getMusicVolume() * 100).toFixed(
          0
        )}%`
      );
      this.status.push(
        `SFX Volume: ${(this.audioContext.getSfxVolume() * 100).toFixed(0)}%`
      );
    }

    if (this.backgroundMusic) {
      this.status.push(
        `Background Music: ${
          this.backgroundMusic.playing ? "Playing" : "Stopped"
        }`
      );
      if (this.backgroundMusic.playing) {
        const current = this.backgroundMusic.getCurrentTime();
        const duration = this.backgroundMusic.getDuration();
        this.status.push(
          `  Time: ${current.toFixed(1)}s / ${duration.toFixed(1)}s`
        );
      }
    }

    if (this.buttonClick) {
      this.status.push(
        `Button Click: ${this.buttonClick.getActiveCount()}/${this.buttonClick.getPoolSize()} active`
      );
    }

    if (this.jumpSound) {
      this.status.push(
        `Jump Sound: ${this.jumpSound.getActiveCount()}/${this.jumpSound.getPoolSize()} active`
      );
    }
  }

  /**
   * Set up basic keyboard listeners for testing
   */
  private setupInputListeners(): void {
    this.keydownHandler = async (event: KeyboardEvent) => {
      await this.handleInput({ key: event.key });
    };

    // Add event listener
    document.addEventListener("keydown", this.keydownHandler);
  }

  async handleInput(input: any): Promise<void> {
    const currentTime = Date.now();

    // Prevent key repeat spam (reduced for testing sound effect pooling)
    if (currentTime - this.lastKeyTime < 50) {
      return;
    }

    if (!this.assetsLoaded || !this.audioContext.initialized) {
      return;
    }

    this.lastKeyTime = currentTime;

    try {
      switch (input.key) {
        case "1":
          await this.toggleBackgroundMusic();
          break;
        case "2":
          this.playButtonClick();
          break;
        case "3":
          this.playJumpSound();
          break;
        case "4":
          this.stopAllAudio();
          break;
        case "5":
          this.toggleMasterVolume();
          break;
        case "6":
          this.toggleMusicVolume();
          break;
        case "7":
          this.toggleSfxVolume();
          break;
        case "8":
          this.testRapidSoundEffects();
          break;
        case "ArrowUp":
          this.increaseMasterVolume();
          break;
        case "ArrowDown":
          this.decreaseMasterVolume();
          break;
      }
    } catch (error) {
      this.logger.error(`Error handling input: ${error}`);
      this.status.push(`ERROR: ${error}`);
    }
  }

  private async toggleBackgroundMusic(): Promise<void> {
    if (!this.backgroundMusic) return;

    if (this.backgroundMusic.playing) {
      this.backgroundMusic.pause();
      this.logger.info("Background music paused");
    } else {
      this.backgroundMusic.play(0.5); // 0.5 second fade-in
      this.logger.info("Background music started");
    }
  }

  private playButtonClick(): void {
    if (!this.buttonClick) return;

    this.buttonClick.play();
    this.logger.debug(
      `Button click played - Active: ${this.buttonClick.getActiveCount()}/${this.buttonClick.getPoolSize()}`
    );
  }

  private playJumpSound(): void {
    if (!this.jumpSound) return;

    // Play with pitch variation for variety
    this.jumpSound.playWithPitch(0.2);
    this.logger.debug(
      `Jump sound played - Active: ${this.jumpSound.getActiveCount()}/${this.jumpSound.getPoolSize()}`
    );
  }

  private stopAllAudio(): void {
    if (this.backgroundMusic) {
      this.backgroundMusic.stop(0.3); // 0.3 second fade-out
    }

    if (this.buttonClick) {
      this.buttonClick.stopAll();
    }

    if (this.jumpSound) {
      this.jumpSound.stopAll();
    }

    this.logger.info("All audio stopped");
  }

  private testRapidSoundEffects(): void {
    if (!this.jumpSound) return;

    this.logger.info("Testing rapid sound effect pooling...");

    // Fire multiple sounds rapidly to test pooling
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.jumpSound!.play();
        this.logger.debug(
          `Rapid test ${
            i + 1
          } - Active: ${this.jumpSound!.getActiveCount()}/${this.jumpSound!.getPoolSize()}`
        );
      }, i * 20); // 20ms intervals
    }
  }

  private toggleMasterVolume(): void {
    const current = this.audioContext.getMasterVolume();
    const newVolume = current >= 1.0 ? 0.5 : 1.0;
    this.audioContext.setMasterVolume(newVolume);
    this.logger.info(`Master volume set to ${(newVolume * 100).toFixed(0)}%`);
  }

  private toggleMusicVolume(): void {
    const current = this.audioContext.getMusicVolume();
    const newVolume = current >= 0.7 ? 0.35 : 0.7;
    this.audioContext.setMusicVolume(newVolume);
    this.logger.info(`Music volume set to ${(newVolume * 100).toFixed(0)}%`);
  }

  private toggleSfxVolume(): void {
    const current = this.audioContext.getSfxVolume();
    const newVolume = current >= 0.8 ? 0.4 : 0.8;
    this.audioContext.setSfxVolume(newVolume);
    this.logger.info(`SFX volume set to ${(newVolume * 100).toFixed(0)}%`);
  }

  private increaseMasterVolume(): void {
    const current = this.audioContext.getMasterVolume();
    const newVolume = Math.min(1.0, current + 0.1); // Clamp to 100%
    this.audioContext.setMasterVolume(newVolume);
    this.logger.info(
      `Master volume increased to ${(newVolume * 100).toFixed(0)}%`
    );
  }

  private decreaseMasterVolume(): void {
    const current = this.audioContext.getMasterVolume();
    const newVolume = Math.max(0.0, current - 0.1); // Clamp to 0%
    this.audioContext.setMasterVolume(newVolume);
    this.logger.info(
      `Master volume decreased to ${(newVolume * 100).toFixed(0)}%`
    );
  }

  update(_deltaTime: number): void {
    // Update status every frame for real-time feedback
    this.updateStatus();
  }

  fixedUpdate(_fixedTimeStep: number): void {
    // No fixed update logic needed for this test scene
  }

  draw(_interpolationFactor: number): void {
    // Set background color
    this.canvas.backgroundColor = Color.fromHex("#1a1a2e");

    // Draw instructions and status
    let y = 50;
    const lineHeight = 25;

    // Draw title
    this.canvas.drawText("Audio Test Scene", 50, y, Color.fromHex("#16a085"));
    y += lineHeight * 2;

    // Draw instructions
    for (const instruction of this.instructions.slice(2)) {
      const color =
        instruction.startsWith("Controls:") || instruction.startsWith("Status:")
          ? Color.fromHex("#e74c3c")
          : Color.fromHex("#ecf0f1");
      this.canvas.drawText(instruction, 50, y, color);
      y += lineHeight;
    }

    // Draw status
    for (const statusLine of this.status) {
      const color = statusLine.startsWith("ERROR:")
        ? Color.fromHex("#e74c3c")
        : Color.fromHex("#2ecc71");
      this.canvas.drawText(statusLine, 50, y, color);
      y += lineHeight;
    }

    // Draw audio context warning if not initialized
    if (!this.audioContext.initialized) {
      const warningY = this.canvas.height - 100;
      this.canvas.drawText(
        "⚠️ Audio Context Not Initialized",
        50,
        warningY,
        Color.fromHex("#f39c12")
      );
      this.canvas.drawText(
        "Audio context should be initialized by Game",
        50,
        warningY + 30,
        Color.fromHex("#f39c12")
      );
    }
  }

  cleanup(): void {
    // Stop all audio when scene is disposed
    this.stopAllAudio();

    // Clean up event listeners
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }

    // Clean up references
    this.backgroundMusic = null;
    this.buttonClick = null;
    this.jumpSound = null;

    this.logger.info("AudioTestScene disposed");
  }
}
