import { NavigatorWithAutoplay, WindowWithWebkitAudio } from "../utils/TypeExtensions";

/**
 * Singleton wrapper for Web Audio API context management.
 * 
 * Provides lazy initialization, volume control via separate gain nodes
 * (master, music, SFX), and handles browser autoplay policies.
 * 
 * Audio routing: AudioContext.destination ← masterGain ← musicGain/sfxGain
 */
export class AudioContext {
  private static instance: AudioContext | null = null;

  private context: globalThis.AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private musicGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;
  private isInitialized = false;
  private isSuspended = false;
  private debugMode = false;

  private constructor() {
    // Web Audio API requires user interaction to initialize
    // We'll defer initialization until first user interaction
  }

  /**
   * Get the singleton instance of AudioContext
   */
  static getInstance(): AudioContext {
    if (!AudioContext.instance) {
      AudioContext.instance = new AudioContext();
    }
    return AudioContext.instance;
  }

  /**
   * Initialize the audio context. Will automatically handle user interaction requirements.
   * @param debugMode - Enable debugging features (default: false)
   */
  async initialize(debugMode: boolean = false): Promise<boolean> {
    this.debugMode = debugMode;
    if (this.isInitialized) {
      return true;
    }

    try {
      // Check autoplay policy if supported
      if ("getAutoplayPolicy" in navigator) {
        const policy = (navigator as NavigatorWithAutoplay).getAutoplayPolicy?.("audiocontext");
        if (policy === "disallowed") {
          console.warn(
            "Audio autoplay is disallowed. Audio context will be created but suspended until user interaction."
          );
        }
      }

      // Create the audio context
      this.context = new (window.AudioContext ||
        (window as WindowWithWebkitAudio).webkitAudioContext)();

      // Create master gain node for overall volume control
      this.masterGainNode = this.context.createGain();
      this.masterGainNode.connect(this.context.destination);

      // Create separate gain nodes for music and sound effects
      this.musicGainNode = this.context.createGain();
      this.musicGainNode.connect(this.masterGainNode);

      this.sfxGainNode = this.context.createGain();
      this.sfxGainNode.connect(this.masterGainNode);

      // Set default volumes
      this.masterGainNode.gain.value = 1.0;
      this.musicGainNode.gain.value = 0.7;
      this.sfxGainNode.gain.value = 0.8;

      this.isInitialized = true;
      this.isSuspended = this.context.state === "suspended";
      
      if (this.debugMode) {
        console.debug("AudioContext initialized with debug mode enabled");
      }

      // Check if context is suspended
      this.isSuspended = this.context.state === "suspended";

      return true;
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
      return false;
    }
  }

  /**
   * Check the autoplay policy for audio contexts (if supported by browser)
   */
  getAutoplayPolicy(): string | null {
    if ("getAutoplayPolicy" in navigator) {
      try {
        return (navigator as NavigatorWithAutoplay).getAutoplayPolicy?.("audiocontext") || null;
      } catch (error) {
        console.warn("Failed to get autoplay policy:", error);
        return null;
      }
    }
    return null;
  }

  /**
   * Check if the audio context can autoplay without user interaction
   */
  canAutoplay(): boolean {
    const policy = this.getAutoplayPolicy();
    return policy === "allowed" || policy === null; // null means unknown, so we assume it might work
  }

  /**
   * Get the native Web Audio API context
   */
  get nativeContext(): globalThis.AudioContext | null {
    return this.context;
  }

  /**
   * Get the master gain node for overall volume control
   */
  get masterGain(): GainNode | null {
    return this.masterGainNode;
  }

  /**
   * Get the music gain node for music volume control
   */
  get musicGain(): GainNode | null {
    return this.musicGainNode;
  }

  /**
   * Get the sound effects gain node for SFX volume control
   */
  get sfxGain(): GainNode | null {
    return this.sfxGainNode;
  }

  /**
   * Check if the audio context is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if the audio context is suspended
   */
  get suspended(): boolean {
    return this.isSuspended || this.context?.state === "suspended";
  }

  /**
   * Get the current state of the audio context
   */
  get state(): AudioContextState | null {
    return this.context?.state || null;
  }

  /**
   * Get the sample rate of the audio context
   */
  get sampleRate(): number {
    return this.context?.sampleRate || 0;
  }

  /**
   * Get the current time in the audio context
   */
  get currentTime(): number {
    return this.context?.currentTime || 0;
  }

  /**
   * Set the master volume (0.0 to 1.0)
   */
  setMasterVolume(volume: number): void {
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Set the music volume (0.0 to 1.0)
   */
  setMusicVolume(volume: number): void {
    if (this.musicGainNode) {
      this.musicGainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Set the sound effects volume (0.0 to 1.0)
   */
  setSfxVolume(volume: number): void {
    if (this.sfxGainNode) {
      this.sfxGainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get the current master volume
   */
  getMasterVolume(): number {
    return this.masterGainNode?.gain.value || 0;
  }

  /**
   * Get the current music volume
   */
  getMusicVolume(): number {
    return this.musicGainNode?.gain.value || 0;
  }

  /**
   * Get the current sound effects volume
   */
  getSfxVolume(): number {
    return this.sfxGainNode?.gain.value || 0;
  }

  /**
   * Suspend the audio context to save resources
   */
  async suspend(): Promise<void> {
    if (this.context && this.context.state === "running") {
      await this.context.suspend();
      this.isSuspended = true;
    }
  }

  /**
   * Resume the audio context
   */
  async resume(): Promise<void> {
    if (this.context && this.context.state === "suspended") {
      await this.context.resume();
      this.isSuspended = false;
    }
  }

  /**
   * Create an audio buffer from an ArrayBuffer
   */
  async createBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer | null> {
    if (!this.context) {
      console.warn("Audio context not initialized");
      return null;
    }

    try {
      return await this.context.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error("Failed to decode audio data:", error);
      return null;
    }
  }

  /**
   * Create a buffer source node
   */
  createBufferSource(): AudioBufferSourceNode | null {
    if (!this.context) {
      console.warn("Audio context not initialized");
      return null;
    }

    return this.context.createBufferSource();
  }

  /**
   * Create a gain node
   */
  createGain(): GainNode | null {
    if (!this.context) {
      console.warn("Audio context not initialized");
      return null;
    }

    return this.context.createGain();
  }

  /**
   * Create a stereo panner node for spatial audio
   */
  createStereoPanner(): StereoPannerNode | null {
    if (!this.context) {
      console.warn("Audio context not initialized");
      return null;
    }

    return this.context.createStereoPanner();
  }

  /**
   * Create a biquad filter node
   */
  createBiquadFilter(): BiquadFilterNode | null {
    if (!this.context) {
      console.warn("Audio context not initialized");
      return null;
    }

    return this.context.createBiquadFilter();
  }

  /**
   * Create a convolver node for reverb effects
   */
  createConvolver(): ConvolverNode | null {
    if (!this.context) {
      console.warn("Audio context not initialized");
      return null;
    }

    return this.context.createConvolver();
  }

  /**
   * Create a delay node
   */
  createDelay(maxDelayTime?: number): DelayNode | null {
    if (!this.context) {
      console.warn("Audio context not initialized");
      return null;
    }

    return this.context.createDelay(maxDelayTime);
  }

  /**
   * Dispose of the audio context and clean up resources
   */
  async dispose(): Promise<void> {
    if (this.context) {
      try {
        await this.context.close();
      } catch (error) {
        console.warn("Error closing audio context:", error);
      }

      this.context = null;
      this.masterGainNode = null;
      this.musicGainNode = null;
      this.sfxGainNode = null;
      this.isInitialized = false;
      this.isSuspended = false;
    }

    // Reset singleton instance
    AudioContext.instance = null;
  }
}
