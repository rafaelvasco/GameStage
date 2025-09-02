// KeyboardInput.ts - High-performance keyboard input handling with frame-based state tracking

import { KeyState } from "./KeyState";
import { Logger, LogColors } from "../../utils/Logger";
import { RuntimeInfo } from "../../utils/RuntimeInfo";
import { BitFlags } from "../BitFlags";
import { Keys } from "./Keys";
import { keyCodeToEnum, enumToKeyCode } from "./KeyMapping";
import { type KeyEvent } from "./KeyEvent";
import { EventPool } from "../EventPool";
import { CircularBuffer } from "../CircularBuffer";

// KeyEvent interface is now imported from separate file

/**
 * High-performance keyboard input manager with frame-based state tracking
 * 
 * Features:
 * - Efficient state tracking using Maps and Sets
 * - Frame-based state transitions (JustPressed/JustReleased)
 * - Event buffering to prevent missed inputs
 * - Support for key names and codes
 * - Modifier key tracking
 * - Performance-optimized with minimal allocations
 */
export class KeyboardInput {
  private logger: Logger;
  
  // Core state tracking (performance-critical) - using bit flags for optimal performance
  private keyStates: Map<string, KeyState> = new Map();
  private previousKeyStates: Map<string, KeyState> = new Map();
  
  // Bit flag optimization for common queries
  private downKeys: BitFlags = new BitFlags(Keys.TOTAL);
  private justPressedKeys: BitFlags = new BitFlags(Keys.TOTAL);
  private justReleasedKeys: BitFlags = new BitFlags(Keys.TOTAL);
  
  // Cached arrays for performance (only rebuilt when dirty)
  private cachedPressedKeys: string[] = [];
  private pressedKeysCacheDirty: boolean = true;
  
  
  // Optimization for state transitions - track only keys that need transitions
  private keysNeedingTransition: Set<string> = new Set();
  
  // Debug info caching to avoid object creation when debug is disabled
  private debugInfoEnabled: boolean = false;
  private cachedDebugInfo: any = null;
  private debugInfoDirty: boolean = true;
  
  // Event buffering for frame-based processing (now using circular buffer + pooling)
  private eventBuffer: CircularBuffer<KeyEvent>;
  private eventPool: EventPool;
  private readonly MAX_EVENTS_PER_FRAME = 64;
  
  // Development-only event drop tracking (zero overhead in production)
  private droppedEventCount: number = 0;
  private lastDropWarningTime: number = 0;
  private readonly DROP_WARNING_THROTTLE_MS = 1000;
  private runtime: RuntimeInfo;
  
  // Performance tracking
  private currentFrame: number = 0;
  private lastUpdateFrame: number = -1;
  
  // Modifier state (cached for performance)
  private modifiers = {
    shift: false,
    control: false,
    alt: false,
    meta: false
  };
  
  // Configuration
  private enabled: boolean = true;
  private preventDefaults: Set<string> = new Set();
  
  constructor() {
    this.logger = Logger.getInstance();
    this.runtime = RuntimeInfo.getInstance();
    
    // Initialize high-performance event handling
    this.eventBuffer = new CircularBuffer<KeyEvent>(this.MAX_EVENTS_PER_FRAME);
    this.eventPool = EventPool.getInstance();
    
    this.setupEventListeners();
    this.logger.info("KeyboardInput initialized with event pooling and circular buffer", LogColors.CYAN);
  }

  /**
   * Set up DOM event listeners for keyboard events
   */
  private setupEventListeners(): void {
    // Use capture phase to ensure we get events before other handlers
    document.addEventListener('keydown', this.handleKeyDown, { capture: true, passive: false });
    document.addEventListener('keyup', this.handleKeyUp, { capture: true, passive: false });
    
    // Handle focus events to reset state when focus is lost
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    
    // Handle visibility change to reset state when tab becomes hidden
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;

    const keyCode = event.code;
    
    // Prevent default if configured
    if (this.preventDefaults.has(keyCode)) {
      event.preventDefault();
    }

    // Skip repeat events for state tracking
    if (event.repeat) return;

    // Buffer the event for frame-based processing (using object pool)
    const pooledEvent = this.eventPool.acquire(
      keyCode,
      'keydown',
      performance.now(),
      event.repeat
    );
    this.bufferEvent(pooledEvent);

    // Update modifier state immediately for synchronous queries
    this.updateModifierState(keyCode, true);
  }

  /**
   * Handle keyup events
   */
  private handleKeyUp = (event: KeyboardEvent): void => {
    if (!this.enabled) return;

    const keyCode = event.code;
    
    // Prevent default if configured
    if (this.preventDefaults.has(keyCode)) {
      event.preventDefault();
    }

    // Buffer the event for frame-based processing (using object pool)
    const pooledEvent = this.eventPool.acquire(
      keyCode,
      'keyup',
      performance.now(),
      false
    );
    this.bufferEvent(pooledEvent);

    // Update modifier state immediately for synchronous queries
    this.updateModifierState(keyCode, false);
  }

  /**
   * Buffer a keyboard event for frame-based processing (with object pooling)
   */
  private bufferEvent(event: KeyEvent): void {
    const overwrittenEvent = this.eventBuffer.push(event);
    
    if (overwrittenEvent) {
      // Buffer was full, an event was overwritten - release it back to pool
      this.eventPool.release(overwrittenEvent);
      
      // Development-only tracking and warnings (zero overhead in production)
      if (this.runtime.enableErrorTracking) {
        this.droppedEventCount++;
        
        // Throttled warning to avoid spam
        const now = performance.now();
        if (now - this.lastDropWarningTime > this.DROP_WARNING_THROTTLE_MS) {
          this.logger.warn(
            `Keyboard event buffer overflow! Dropped ${this.droppedEventCount} events. ` +
            `Consider increasing MAX_EVENTS_PER_FRAME or optimizing game loop performance. ` +
            `Buffer size: ${this.MAX_EVENTS_PER_FRAME}, Total dropped: ${this.droppedEventCount}`
          );
          this.lastDropWarningTime = now;
        }
      }
    }
  }

  /**
   * Update modifier key state for immediate queries
   */
  private updateModifierState(keyCode: string, pressed: boolean): void {
    switch (keyCode) {
      case 'ShiftLeft':
      case 'ShiftRight':
        this.modifiers.shift = pressed;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        this.modifiers.control = pressed;
        break;
      case 'AltLeft':
      case 'AltRight':
        this.modifiers.alt = pressed;
        break;
      case 'MetaLeft':
      case 'MetaRight':
        this.modifiers.meta = pressed;
        break;
    }
  }

  /**
   * Handle window blur - reset all key states
   */
  private handleWindowBlur = (): void => {
    this.resetAllKeys();
    this.logger.debug("KeyboardInput: Window blur, resetting all key states");
  }

  /**
   * Handle window focus - clear any stale states
   */
  private handleWindowFocus = (): void => {
    this.resetAllKeys();
    this.logger.debug("KeyboardInput: Window focus, clearing stale states");
  }

  /**
   * Handle visibility change - reset state when tab becomes hidden
   */
  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.resetAllKeys();
      this.logger.debug("KeyboardInput: Tab hidden, resetting all key states");
    }
  }

  /**
   * Reset all key states (used when focus is lost)
   */
  private resetAllKeys(): void {
    // Move all currently pressed keys to released state
    for (const [keyCode, state] of this.keyStates) {
      if (state === KeyState.Down || state === KeyState.JustPressed) {
        this.keyStates.set(keyCode, KeyState.JustReleased);
        
        // Update bit flags
        const keyEnum = keyCodeToEnum(keyCode);
        if (keyEnum !== undefined) {
          this.downKeys.set(keyEnum, false);
          this.justPressedKeys.set(keyEnum, false);
          this.justReleasedKeys.set(keyEnum, true);
        }
        
        // Mark key as needing transition next frame
        this.keysNeedingTransition.add(keyCode);
      }
    }
    
    // Reset modifiers
    this.modifiers.shift = false;
    this.modifiers.control = false;
    this.modifiers.alt = false;
    this.modifiers.meta = false;
    
    // Clear event buffer and release events back to pool
    const eventsToRelease = this.eventBuffer.drain();
    this.eventPool.releaseMany(eventsToRelease);
    
    // Clear any remaining keys in transition set to prevent memory leaks
    this.keysNeedingTransition.clear();
    
    // Reset drop statistics in development
    if (this.runtime.enableErrorTracking) {
      this.droppedEventCount = 0;
    }
    
    // Mark cache as dirty
    this.pressedKeysCacheDirty = true;
  }

  /**
   * Update key states for the current frame
   * This should be called once per frame by the game loop
   */
  update(frameNumber: number): void {
    this.currentFrame = frameNumber;
    
    // Prevent multiple updates per frame
    if (this.lastUpdateFrame === frameNumber) {
      return;
    }
    this.lastUpdateFrame = frameNumber;

    // Update state transitions from previous frame first
    this.updateStateTransitions();

    // Copy current states to previous for transition detection
    this.previousKeyStates.clear();
    for (const [keyCode, state] of this.keyStates) {
      this.previousKeyStates.set(keyCode, state);
    }

    // Process buffered events
    this.processBufferedEvents();

    // Event buffer is already cleared in processBufferedEvents()
  }

  /**
   * Process all buffered keyboard events (with efficient iteration and object pooling)
   */
  private processBufferedEvents(): void {
    // Process events using circular buffer's efficient iteration
    this.eventBuffer.forEach((event) => {
      const currentState = this.keyStates.get(event.code) || KeyState.Up;
      const keyEnum = keyCodeToEnum(event.code);
      
      if (event.type === 'keydown') {
        // Only transition to JustPressed if key was up
        if (currentState === KeyState.Up || currentState === KeyState.JustReleased) {
          this.keyStates.set(event.code, KeyState.JustPressed);
          
          // Update bit flags using enum as direct index
          if (keyEnum !== undefined) {
            this.downKeys.set(keyEnum, true);
            this.justPressedKeys.set(keyEnum, true);
            this.justReleasedKeys.set(keyEnum, false);
          }
          this.pressedKeysCacheDirty = true;
          
          // Mark key as needing transition next frame
          this.keysNeedingTransition.add(event.code);
          
          // Mark debug info as dirty if debug is enabled
          if (this.debugInfoEnabled) {
            this.debugInfoDirty = true;
          }
        }
      } else if (event.type === 'keyup') {
        // Only transition to JustReleased if key was down
        if (currentState === KeyState.Down || currentState === KeyState.JustPressed) {
          this.keyStates.set(event.code, KeyState.JustReleased);
          
          // Update bit flags using enum as direct index
          if (keyEnum !== undefined) {
            this.downKeys.set(keyEnum, false);
            this.justPressedKeys.set(keyEnum, false);
            this.justReleasedKeys.set(keyEnum, true);
          }
          this.pressedKeysCacheDirty = true;
          
          // Mark key as needing transition next frame
          this.keysNeedingTransition.add(event.code);
          
          // Mark debug info as dirty if debug is enabled
          if (this.debugInfoEnabled) {
            this.debugInfoDirty = true;
          }
        }
      }
    });
    
    // Release all processed events back to the pool and clear buffer
    const processedEvents = this.eventBuffer.drain();
    this.eventPool.releaseMany(processedEvents);
  }

  /**
   * Update state transitions for frame-based queries (optimized - only process keys that need transitions)
   */
  private updateStateTransitions(): void {
    // Only process keys that actually need state transitions
    // Use iterator to avoid array allocation
    for (const keyCode of this.keysNeedingTransition) {
      const state = this.keyStates.get(keyCode);
      if (!state) continue;
      
      const keyEnum = keyCodeToEnum(keyCode);
      if (keyEnum === undefined) continue;
      
      switch (state) {
        case KeyState.JustPressed:
          // JustPressed -> Down after one frame
          this.keyStates.set(keyCode, KeyState.Down);
          this.justPressedKeys.set(keyEnum, false);
          // downKeys remains true
          break;
        case KeyState.JustReleased:
          // JustReleased -> Up after one frame
          this.keyStates.set(keyCode, KeyState.Up);
          this.justReleasedKeys.set(keyEnum, false);
          // downKeys already false
          break;
        // Down and Up states remain until changed by events
      }
    }
    
    // Clear the transition set after processing
    this.keysNeedingTransition.clear();
  }

  // =======================================================================
  // Public API - Easy to use query methods
  // =======================================================================

  /**
   * Check if a key is currently being held down
   * @param key - Keys enum value (e.g., Keys.W, Keys.Space)
   * @returns True if the key is currently pressed
   */
  isKeyDown(key: Keys): boolean {
    return this.downKeys.get(key);
  }

  /**
   * Check if a key was just pressed this frame
   * @param key - Keys enum value (e.g., Keys.W, Keys.Space)
   * @returns True if the key was just pressed
   */
  wasKeyJustPressed(key: Keys): boolean {
    return this.justPressedKeys.get(key);
  }

  /**
   * Check if a key was just released this frame
   * @param key - Keys enum value (e.g., Keys.W, Keys.Space)
   * @returns True if the key was just released
   */
  wasKeyJustReleased(key: Keys): boolean {
    return this.justReleasedKeys.get(key);
  }

  /**
   * Check if a key is currently up (not pressed)
   * @param key - Keys enum value (e.g., Keys.W, Keys.Space)
   * @returns True if the key is not pressed
   */
  isKeyUp(key: Keys): boolean {
    return !this.downKeys.get(key);
  }

  /**
   * Get the current state of a key
   * @param key - Keys enum value (e.g., Keys.W, Keys.Space)
   * @returns The current KeyState
   */
  getKeyState(key: Keys): KeyState {
    const keyCode = enumToKeyCode(key);
    return this.keyStates.get(keyCode) || KeyState.Up;
  }

  /**
   * Check if any key is currently pressed
   * @returns True if any key is currently down
   */
  isAnyKeyDown(): boolean {
    return this.downKeys.hasAny();
  }

  /**
   * Get all currently pressed keys
   * @returns Array of key codes that are currently pressed
   */
  getPressedKeys(): string[] {
    // Use cached array if available and not dirty
    if (!this.pressedKeysCacheDirty && this.cachedPressedKeys.length >= 0) {
      return this.cachedPressedKeys;
    }
    
    // Rebuild cache using Keys enum
    this.cachedPressedKeys.length = 0;
    const pressedIndices = this.downKeys.getSetIndices();
    
    for (const keyEnum of pressedIndices) {
      // Convert Keys enum back to keyCode using KeyMapping
      const keyCode = enumToKeyCode(keyEnum);
      if (keyCode) {
        this.cachedPressedKeys.push(keyCode);
      }
    }
    
    this.pressedKeysCacheDirty = false;
    return this.cachedPressedKeys;
  }

  // =======================================================================
  // Modifier key queries
  // =======================================================================

  /**
   * Check if Shift key is pressed
   */
  get isShiftDown(): boolean {
    return this.modifiers.shift;
  }

  /**
   * Check if Control key is pressed
   */
  get isControlDown(): boolean {
    return this.modifiers.control;
  }

  /**
   * Check if Alt key is pressed
   */
  get isAltDown(): boolean {
    return this.modifiers.alt;
  }

  /**
   * Check if Meta key (Cmd/Windows key) is pressed
   */
  get isMetaDown(): boolean {
    return this.modifiers.meta;
  }

  // =======================================================================
  // Configuration and utility methods
  // =======================================================================

  /**
   * Enable or disable keyboard input processing
   * @param enabled - Whether to process keyboard events
   */
  setEnabled(enabled: boolean): void {
    if (!enabled && this.enabled) {
      // Reset all keys when disabling
      this.resetAllKeys();
    }
    this.enabled = enabled;
  }

  /**
   * Check if keyboard input is enabled
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Add a key to the prevent default list
   * @param key - Keys enum value to prevent default behavior for
   */
  preventDefault(key: Keys): void {
    const keyCode = enumToKeyCode(key);
    this.preventDefaults.add(keyCode);
  }

  /**
   * Remove a key from the prevent default list
   * @param key - Keys enum value to stop preventing default behavior for
   */
  allowDefault(key: Keys): void {
    const keyCode = enumToKeyCode(key);
    this.preventDefaults.delete(keyCode);
  }

  /**
   * Clear all preventDefault settings
   */
  clearPreventDefaults(): void {
    this.preventDefaults.clear();
  }
  
  /**
   * Enable or disable debug info generation
   * @param enabled - Whether to generate detailed debug info
   */
  setDebugInfoEnabled(enabled: boolean): void {
    this.debugInfoEnabled = enabled;
    if (!enabled) {
      // Clear debug cache when disabling to free memory
      this.cachedDebugInfo = null;
    }
    this.debugInfoDirty = true;
  }
  
  /**
   * Check if debug info generation is enabled
   */
  get isDebugInfoEnabled(): boolean {
    return this.debugInfoEnabled;
  }

  /**
   * Get debug information about the current input state (optimized - only when debug is enabled)
   */
  getDebugInfo(): {
    totalKeys: number;
    pressedKeys: number;
    bufferedEvents: number;
    currentFrame: number;
    modifiers: {
      shift: boolean;
      control: boolean;
      alt: boolean;
      meta: boolean;
    };
    bitFlags?: {
      downKeys: any;
      justPressedKeys: any;
      justReleasedKeys: any;
    };
    keyMapping?: any;
    cacheStats?: {
      pressedKeysCacheDirty: boolean;
      cachedPressedKeysLength: number;
    };
  } {
    // Return minimal info if debug is not enabled
    if (!this.debugInfoEnabled) {
      return {
        totalKeys: this.keyStates.size,
        pressedKeys: this.downKeys.getSetCount(),
        bufferedEvents: this.eventBuffer.length,
        ...(this.runtime.enableErrorTracking && { droppedEvents: this.droppedEventCount }),
        currentFrame: this.currentFrame,
        modifiers: { ...this.modifiers },
        ...(this.runtime.enablePerfTracking && {
          memoryStats: {
            eventPoolStats: this.eventPool.getStats(),
            bufferStats: this.eventBuffer.getDebugInfo()
          }
        })
      };
    }

    // Cache debug info to avoid expensive object creation
    if (this.debugInfoDirty || !this.cachedDebugInfo) {
      this.cachedDebugInfo = {
        totalKeys: this.keyStates.size,
        pressedKeys: this.downKeys.getSetCount(),
        bufferedEvents: this.eventBuffer.length,
        ...(this.runtime.enableErrorTracking && { droppedEvents: this.droppedEventCount }),
        currentFrame: this.currentFrame,
        modifiers: { ...this.modifiers },
        bitFlags: {
          downKeys: this.downKeys.getDebugInfo(),
          justPressedKeys: this.justPressedKeys.getDebugInfo(),
          justReleasedKeys: this.justReleasedKeys.getDebugInfo()
        },
        cacheStats: {
          pressedKeysCacheDirty: this.pressedKeysCacheDirty,
          cachedPressedKeysLength: this.cachedPressedKeys.length
        },
        ...(this.runtime.enablePerfTracking && {
          memoryStats: {
            eventPoolStats: this.eventPool.getStats(),
            bufferStats: this.eventBuffer.getDebugInfo()
          }
        })
      };
      this.debugInfoDirty = false;
    } else {
      // Update only frequently changing values
      this.cachedDebugInfo.pressedKeys = this.downKeys.getSetCount();
      this.cachedDebugInfo.bufferedEvents = this.eventBuffer.length;
      this.cachedDebugInfo.currentFrame = this.currentFrame;
      this.cachedDebugInfo.cacheStats.pressedKeysCacheDirty = this.pressedKeysCacheDirty;
      this.cachedDebugInfo.cacheStats.cachedPressedKeysLength = this.cachedPressedKeys.length;
    }

    return this.cachedDebugInfo;
  }

  /**
   * Clean up event listeners and resources
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    this.keyStates.clear();
    this.previousKeyStates.clear();
    // Clear event buffer and release events back to pool
    const eventsToRelease = this.eventBuffer.drain();
    this.eventPool.releaseMany(eventsToRelease);
    
    
    this.preventDefaults.clear();
    
    // Reset drop statistics in development
    if (this.runtime.enableErrorTracking) {
      this.droppedEventCount = 0;
    }
    
    // Clear bit flags
    this.downKeys.clear();
    this.justPressedKeys.clear();
    this.justReleasedKeys.clear();
    
    // Clear cached arrays
    this.cachedPressedKeys.length = 0;
    this.pressedKeysCacheDirty = true;
    
    // Clear transition tracking
    this.keysNeedingTransition.clear();
    
    // Clear debug cache
    this.cachedDebugInfo = null;
    this.debugInfoDirty = true;
    
    this.logger.info("KeyboardInput destroyed");
  }
}