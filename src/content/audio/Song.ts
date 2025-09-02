import { Asset } from "../Asset";
import { AudioLoader } from "../loaders/AudioLoader";
import { AudioContext } from "../../audio/AudioContext";
import { Logger } from "../../utils/Logger";

/**
 * Song asset for background music with looping support.
 * 
 * Optimized implementation following Web Audio API best practices:
 * - AudioBuffer reuse for memory efficiency
 * - GainNode persistence for parameter stability
 * - AudioBufferSourceNode recreation only when necessary
 * - Precise scheduling using AudioParam methods
 */
export class Song extends Asset {
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private isPaused = false;
  private pausedAt = 0;
  private startedAt = 0;
  private volume = 1.0;
  private loop = false;
  private logger = Logger.getInstance();
  private fadeOutTimeout: number | null = null;

  constructor(id: string, filePath: string, volume = 1.0, loop = false) {
    super(id, filePath);
    this.volume = Math.max(0, Math.min(1, volume));
    this.loop = loop;
  }

  async load(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    if (!this.filePath) {
      throw new Error(`Song ${this.id} has no file path`);
    }

    try {
      const audioLoader = AudioLoader.getInstance();
      this.audioBuffer = await audioLoader.loadAudioBuffer(this.filePath);
    } catch (error) {
      this.logger.error(`Failed to load song: ${this.id} - ${error}`);
      throw error;
    }
  }

  get isLoaded(): boolean {
    return this.audioBuffer !== null;
  }

  /**
   * Play the song with optional fade-in
   * Optimized: Early exit if already playing, minimal node creation
   */
  play(fadeInDuration = 0): void {
    if (!this.isLoaded) {
      this.logger.warn(`Song ${this.id} not loaded`);
      return;
    }

    // Early exit if already playing (idempotent operation)
    if (this.isPlaying) {
      return;
    }

    const audioContext = AudioContext.getInstance();
    if (!audioContext.initialized || audioContext.suspended) {
      this.logger.warn("AudioContext not ready");
      return;
    }

    // Create GainNode once and reuse (best practice: GainNodes are cheap to keep)
    if (!this.gainNode) {
      this.gainNode = audioContext.createGain();
      if (!this.gainNode) {
        this.logger.error("Failed to create gain node");
        return;
      }
      // Connect to audio graph once
      this.gainNode.connect(audioContext.musicGain!);
    }

    // Always create new source node (Web Audio API requirement: single-use)
    this.sourceNode = audioContext.createBufferSource();
    if (!this.sourceNode) {
      this.logger.error("Failed to create audio source");
      return;
    }

    // Set up source node properties
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.loop = this.loop;
    this.sourceNode.connect(this.gainNode);

    // Handle playback end (cleanup source node only)
    this.sourceNode.onended = () => {
      if (!this.loop) {
        this.isPlaying = false;
        this.isPaused = false;
        this.sourceNode = null;
        // Keep gainNode for reuse
      }
    };

    // Use precise AudioParam scheduling for volume control
    const now = audioContext.currentTime;
    if (fadeInDuration > 0) {
      this.gainNode.gain.setValueAtTime(0, now);
      this.gainNode.gain.linearRampToValueAtTime(this.volume, now + fadeInDuration);
    } else {
      this.gainNode.gain.setValueAtTime(this.volume, now);
    }

    // Start playback with precise timing
    const startTime = this.isPaused ? this.pausedAt : 0;
    this.sourceNode.start(0, startTime);
    this.startedAt = now - startTime;
    this.isPlaying = true;
    this.isPaused = false;

    this.logger.debug(`Song playing: ${this.id}${this.isPaused ? ` from ${this.pausedAt.toFixed(2)}s` : ''}`);
  }

  /**
   * Pause playback while preserving position and GainNode
   * Optimized: Keep GainNode connected and ready for resume
   */
  pause(): void {
    if (!this.isPlaying || this.isPaused) {
      return;
    }

    const audioContext = AudioContext.getInstance();
    if (audioContext.initialized) {
      this.pausedAt = audioContext.currentTime - this.startedAt;
    }

    // Stop source node (becomes unusable, will recreate on resume)
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode = null;
    }

    // Keep GainNode connected and ready (optimization)
    // this.gainNode remains intact with volume settings

    this.isPlaying = false;
    this.isPaused = true;

    this.logger.debug(`Song paused: ${this.id} at ${this.pausedAt.toFixed(2)}s`);
  }

  /**
   * Resume from pause position
   * Optimized: Reuses existing GainNode
   */
  resume(): void {
    if (!this.isPaused) {
      return;
    }

    this.play(); // Will reuse gainNode and start from pausedAt
  }

  /**
   * Stop playback and reset to beginning
   * Optimized: Always cleanup source, simplified API
   */
  stop(fadeOutDuration = 0): void {
    if (!this.sourceNode && !this.isPlaying) {
      // Already stopped, just reset state
      this.resetState();
      return;
    }

    if (fadeOutDuration > 0 && this.gainNode) {
      const audioContext = AudioContext.getInstance();
      const now = audioContext.currentTime;
      
      // Use precise AudioParam scheduling for fade-out
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + fadeOutDuration);

      // Clear any existing timeout
      if (this.fadeOutTimeout !== null) {
        clearTimeout(this.fadeOutTimeout);
      }

      // Schedule stop and cleanup
      this.fadeOutTimeout = window.setTimeout(() => {
        this.sourceNode?.stop();
        this.resetState();
        // Reset gain for next play
        if (this.gainNode) {
          this.gainNode.gain.setValueAtTime(this.volume, audioContext.currentTime);
        }
        this.fadeOutTimeout = null;
      }, fadeOutDuration * 1000);
    } else {
      // Clear any existing timeout for immediate stop
      if (this.fadeOutTimeout !== null) {
        clearTimeout(this.fadeOutTimeout);
        this.fadeOutTimeout = null;
      }
      
      // Immediate stop
      if (this.sourceNode) {
        this.sourceNode.stop();
      }
      this.resetState();
    }

    this.logger.debug(`Song stopped: ${this.id}`);
  }

  /**
   * Set volume using precise AudioParam scheduling
   * Optimized: Uses setValueAtTime for glitch-free updates
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      // Use precise scheduling to avoid audio glitches
      this.gainNode.gain.setValueAtTime(this.volume, AudioContext.getInstance().currentTime);
    }
  }

  getVolume(): number {
    return this.volume;
  }

  /**
   * Get current playback position with loop handling
   */
  getCurrentTime(): number {
    if (!this.isPlaying || !this.audioBuffer) {
      return this.isPaused ? this.pausedAt : 0;
    }

    const audioContext = AudioContext.getInstance();
    const elapsed = audioContext.currentTime - this.startedAt;

    if (this.loop) {
      return elapsed % this.audioBuffer.duration;
    }

    return Math.min(elapsed, this.audioBuffer.duration);
  }

  getDuration(): number {
    return this.audioBuffer?.duration || 0;
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  /**
   * Reset playback state without touching GainNode
   * Optimized: Keep GainNode for reuse
   */
  private resetState(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAt = 0;
    this.startedAt = 0;
    this.sourceNode = null;
    // Keep gainNode for reuse
  }

  /**
   * Complete cleanup including GainNode disconnection
   */
  dispose(): void {
    // Clear any pending fade-out timeouts to prevent memory leaks
    if (this.fadeOutTimeout !== null) {
      clearTimeout(this.fadeOutTimeout);
      this.fadeOutTimeout = null;
    }
    
    this.stop(); // Stop with cleanup
    
    // Disconnect and cleanup GainNode
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    // Release AudioBuffer reference (allows GC if not shared)
    this.audioBuffer = null;
  }
}