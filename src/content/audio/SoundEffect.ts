import { Asset } from "../Asset";
import { AudioLoader } from "../loaders/AudioLoader";
import { AudioContext } from "../../audio/AudioContext";
import { Logger } from "../../utils/Logger";

/**
 * Default pool size for sound effect concurrent playback.
 * This allows up to 8 instances of the same sound effect to play simultaneously,
 * which is sufficient for most game development scenarios.
 */
const DEFAULT_POOL_SIZE = 8;

/**
 * SoundEffect asset for short audio clips with object pooling.
 * 
 * Optimized implementation following Web Audio API best practices:
 * - AudioBuffer reuse for memory efficiency
 * - Shared GainNode for reduced allocations
 * - AudioBufferSourceNode pooling for concurrent playback
 * - Precise scheduling using AudioParam methods
 * - DRY code principles with shared playback logic
 */
export class SoundEffect extends Asset {
  private audioBuffer: AudioBuffer | null = null;
  private volume = 1.0;
  private poolSize: number;
  private activeNodes = new Set<AudioBufferSourceNode>();
  private sharedGainNode: GainNode | null = null; // Optimization: shared gain node
  private logger = Logger.getInstance();

  constructor(id: string, filePath: string, volume = 1.0, poolSize?: number) {
    super(id, filePath);
    this.volume = Math.max(0, Math.min(1, volume));
    this.poolSize = Math.max(1, poolSize ?? DEFAULT_POOL_SIZE);
  }

  async load(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    if (!this.filePath) {
      throw new Error(`SoundEffect ${this.id} has no file path`);
    }

    try {
      const audioLoader = AudioLoader.getInstance();
      this.audioBuffer = await audioLoader.loadAudioBuffer(this.filePath);
    } catch (error) {
      this.logger.error(`Failed to load sound effect: ${this.id} - ${error}`);
      throw error;
    }
  }

  get isLoaded(): boolean {
    return this.audioBuffer !== null;
  }

  /**
   * Play sound effect with optional volume override
   * Optimized: Uses shared gain node and consolidated logic
   */
  play(volumeOverride?: number): void {
    this.playInternal(volumeOverride);
  }

  /**
   * Play with random pitch variation for variety
   * Optimized: Uses shared logic with pitch parameter
   */
  playWithPitch(pitchVariation = 0.1, volumeOverride?: number): void {
    this.playInternal(volumeOverride, pitchVariation);
  }

  /**
   * Internal consolidated play method (DRY principle)
   * Optimized: Single implementation for both play methods
   */
  private playInternal(volumeOverride?: number, pitchVariation?: number): void {
    if (!this.isLoaded) {
      return;
    }

    const audioContext = AudioContext.getInstance();
    if (!audioContext.initialized || audioContext.suspended) {
      return;
    }

    // Create shared GainNode once and reuse (optimization from Song.ts)
    if (!this.sharedGainNode) {
      this.sharedGainNode = audioContext.createGain();
      if (!this.sharedGainNode) {
        this.logger.error("Failed to create shared gain node");
        return;
      }
      // Connect to audio graph once
      this.sharedGainNode.connect(audioContext.sfxGain!);
    }

    // Limit concurrent playback to pool size
    if (this.activeNodes.size >= this.poolSize) {
      // Stop oldest node to make room (LRU eviction)
      const oldest = this.activeNodes.values().next().value;
      if (oldest) {
        this.stopNode(oldest);
      }
    }

    // Always create new source node (Web Audio API requirement: single-use)
    const sourceNode = audioContext.createBufferSource();
    if (!sourceNode) {
      return;
    }

    // Set up source node properties
    sourceNode.buffer = this.audioBuffer;
    sourceNode.connect(this.sharedGainNode);

    // Apply pitch variation if specified (optimization: conditional logic)
    if (pitchVariation !== undefined && pitchVariation > 0) {
      const pitchMultiplier = 1 + (Math.random() - 0.5) * 2 * pitchVariation;
      sourceNode.playbackRate.setValueAtTime(pitchMultiplier, audioContext.currentTime);
    }

    // Use precise AudioParam scheduling for volume (optimization from Song.ts)
    const playVolume = volumeOverride !== undefined ? 
      Math.max(0, Math.min(1, volumeOverride)) : this.volume;
    this.sharedGainNode.gain.setValueAtTime(playVolume, audioContext.currentTime);

    // Handle playback end (cleanup source node only)
    sourceNode.onended = () => {
      this.activeNodes.delete(sourceNode);
      // Keep sharedGainNode for reuse
    };

    // Start playback and track active node
    sourceNode.start(0);
    this.activeNodes.add(sourceNode);
  }

  /**
   * Stop all active instances of this sound effect
   */
  stopAll(): void {
    for (const node of this.activeNodes) {
      this.stopNode(node);
    }
    this.activeNodes.clear();
  }

  /**
   * Stop a specific audio node
   * Optimized: Proper error handling and cleanup
   */
  private stopNode(node: AudioBufferSourceNode): void {
    try {
      node.stop();
    } catch (error) {
      // Node might already be stopped - this is normal
    }
    this.activeNodes.delete(node);
  }

  /**
   * Set default volume for future playbacks
   * Optimized: Uses precise AudioParam scheduling
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    // Update shared gain node if it exists and no active playback
    if (this.sharedGainNode && this.activeNodes.size === 0) {
      this.sharedGainNode.gain.setValueAtTime(this.volume, AudioContext.getInstance().currentTime);
    }
  }

  getVolume(): number {
    return this.volume;
  }

  getDuration(): number {
    return this.audioBuffer?.duration || 0;
  }

  /**
   * Get number of currently active playbacks
   */
  getActiveCount(): number {
    return this.activeNodes.size;
  }

  /**
   * Get pool size limit
   */
  getPoolSize(): number {
    return this.poolSize;
  }

  /**
   * Set pool size limit with dynamic adjustment
   * Optimized: Immediately enforces new limit
   */
  setPoolSize(size: number): void {
    this.poolSize = Math.max(1, size);

    // Stop excess nodes if pool size reduced (optimization: immediate enforcement)
    while (this.activeNodes.size > this.poolSize) {
      const oldest = this.activeNodes.values().next().value;
      if (oldest) {
        this.stopNode(oldest);
      }
    }
  }

  /**
   * Complete cleanup including shared GainNode disconnection
   * Optimized: Proper resource cleanup
   */
  dispose(): void {
    this.stopAll();
    
    // Disconnect and cleanup shared GainNode
    if (this.sharedGainNode) {
      this.sharedGainNode.disconnect();
      this.sharedGainNode = null;
    }
    
    // Release AudioBuffer reference (allows GC if not shared)
    this.audioBuffer = null;
  }
}