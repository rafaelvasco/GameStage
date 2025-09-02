// GamepadInput.ts - High-performance gamepad input handling with frame-based state tracking

import { GamepadState } from "./GamepadState";
import { GamepadButtons } from "./GamepadButtons";
import { Logger, LogColors } from "../../utils/Logger";
import { RuntimeInfo } from "../../utils/RuntimeInfo";
import { BitFlags } from "../BitFlags";
import { type GamepadEvent } from "./GamepadEvent";
import { GamepadEventPool } from "./GamepadEventPool";
import { CircularBuffer } from "../CircularBuffer";

/**
 * Represents a single gamepad's state and analog inputs
 */
interface GamepadSnapshot {
  // Button states using bit flags for performance
  downButtons: BitFlags;
  justPressedButtons: BitFlags;
  justReleasedButtons: BitFlags;
  
  // Button state maps for compatibility
  buttonStates: Map<number, GamepadState>;
  
  // Analog inputs (normalized -1 to 1)
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  leftTrigger: number;  // 0 to 1
  rightTrigger: number; // 0 to 1
  
  // Previous values for delta calculation
  previousLeftStick: { x: number; y: number };
  previousRightStick: { x: number; y: number };
  
  // Connected state
  connected: boolean;
  id: string;
  mapping: string;
  
  // Cached arrays for performance
  cachedPressedButtons: number[];
  pressedButtonsCacheDirty: boolean;
  
  // Transition tracking
  buttonsNeedingTransition: Set<number>;
}

/**
 * High-performance gamepad input manager with frame-based state tracking
 * 
 * Features:
 * - Support for up to 4 gamepads simultaneously
 * - Efficient button state tracking using BitFlags
 * - Frame-based state transitions (JustPressed/JustReleased)
 * - Analog stick and trigger support with deadzone handling
 * - Event buffering to prevent missed inputs during polling
 * - Performance-optimized with minimal allocations
 * - Automatic gamepad connection/disconnection handling
 */
export class GamepadInput {
  private logger: Logger;
  
  // Core gamepad state tracking (up to 4 gamepads)
  private gamepads: Map<number, GamepadSnapshot> = new Map();
  private connectedGamepads: Set<number> = new Set();
  
  // Event buffering for frame-based processing
  private eventBuffer: CircularBuffer<GamepadEvent>;
  private eventPool: GamepadEventPool;
  private readonly MAX_EVENTS_PER_FRAME = 128;
  
  // Debug info caching to avoid object creation when debug is disabled
  private debugInfoEnabled: boolean = false;
  private cachedDebugInfo: any = null;
  private debugInfoDirty: boolean = true;
  
  // Development-only event drop tracking
  private droppedEventCount: number = 0;
  private lastDropWarningTime: number = 0;
  private readonly DROP_WARNING_THROTTLE_MS = 1000;
  private runtime: RuntimeInfo;
  
  // Performance tracking
  private currentFrame: number = 0;
  private lastUpdateFrame: number = -1;
  private pollRate: number = 0;
  private lastPollTime: number = 0;
  
  // Configuration
  private enabled: boolean = true;
  private deadzone: number = 0.1; // Default deadzone for analog inputs
  private triggerDeadzone: number = 0.05; // Smaller deadzone for triggers
  
  // Constants for button mapping (standard gamepad layout)
  private readonly BUTTON_THRESHOLD = 0.5; // Threshold for analog button press
  
  constructor() {
    this.logger = Logger.getInstance();
    this.runtime = RuntimeInfo.getInstance();
    
    // Initialize high-performance event handling
    this.eventBuffer = new CircularBuffer<GamepadEvent>(this.MAX_EVENTS_PER_FRAME);
    this.eventPool = GamepadEventPool.getInstance();
    
    this.setupEventListeners();
    this.logger.info("GamepadInput initialized with event pooling and circular buffer", LogColors.CYAN);
  }
  
  /**
   * Set up gamepad event listeners
   */
  private setupEventListeners(): void {
    // Handle gamepad connection/disconnection
    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    
    // Handle window blur/focus to reset state
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }
  
  /**
   * Handle gamepad connection
   */
  private handleGamepadConnected = (event: Event): void => {
    const gamepad = (event as any).gamepad;
    this.logger.info(`Gamepad connected: ${gamepad.id} (index: ${gamepad.index})`, LogColors.SUCCESS);
    this.initializeGamepad(gamepad.index, gamepad.id, gamepad.mapping);
  };
  
  /**
   * Handle gamepad disconnection
   */
  private handleGamepadDisconnected = (event: Event): void => {
    const gamepad = (event as any).gamepad;
    this.logger.info(`Gamepad disconnected: ${gamepad.id} (index: ${gamepad.index})`, LogColors.WARN);
    this.removeGamepad(gamepad.index);
  };
  
  /**
   * Initialize a gamepad snapshot
   */
  private initializeGamepad(index: number, id: string, mapping: string): void {
    const snapshot: GamepadSnapshot = {
      downButtons: new BitFlags(GamepadButtons.TOTAL),
      justPressedButtons: new BitFlags(GamepadButtons.TOTAL),
      justReleasedButtons: new BitFlags(GamepadButtons.TOTAL),
      buttonStates: new Map(),
      leftStick: { x: 0, y: 0 },
      rightStick: { x: 0, y: 0 },
      leftTrigger: 0,
      rightTrigger: 0,
      previousLeftStick: { x: 0, y: 0 },
      previousRightStick: { x: 0, y: 0 },
      connected: true,
      id: id,
      mapping: mapping,
      cachedPressedButtons: [],
      pressedButtonsCacheDirty: true,
      buttonsNeedingTransition: new Set()
    };
    
    this.gamepads.set(index, snapshot);
    this.connectedGamepads.add(index);
    
    if (this.debugInfoEnabled) {
      this.debugInfoDirty = true;
    }
  }
  
  /**
   * Remove a gamepad
   */
  private removeGamepad(index: number): void {
    this.gamepads.delete(index);
    this.connectedGamepads.delete(index);
    
    if (this.debugInfoEnabled) {
      this.debugInfoDirty = true;
    }
  }
  
  /**
   * Handle window blur - reset all gamepad states
   */
  private handleWindowBlur = (): void => {
    this.resetAllGamepads();
    this.logger.debug("GamepadInput: Window blur, resetting all gamepad states");
  };
  
  /**
   * Handle window focus - clear any stale states
   */
  private handleWindowFocus = (): void => {
    this.resetAllGamepads();
    this.logger.debug("GamepadInput: Window focus, clearing stale states");
  };
  
  /**
   * Handle visibility change - reset state when tab becomes hidden
   */
  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.resetAllGamepads();
      this.logger.debug("GamepadInput: Tab hidden, resetting all gamepad states");
    }
  };
  
  /**
   * Reset all gamepad states
   */
  private resetAllGamepads(): void {
    for (const [, snapshot] of this.gamepads) {
      // Move all currently pressed buttons to released state
      for (const [button, state] of snapshot.buttonStates) {
        if (state === GamepadState.Down || state === GamepadState.JustPressed) {
          snapshot.buttonStates.set(button, GamepadState.JustReleased);
          
          // Update bit flags
          if (button < GamepadButtons.TOTAL) {
            snapshot.downButtons.set(button, false);
            snapshot.justPressedButtons.set(button, false);
            snapshot.justReleasedButtons.set(button, true);
          }
          
          snapshot.buttonsNeedingTransition.add(button);
        }
      }
      
      // Reset analog inputs
      snapshot.leftStick.x = 0;
      snapshot.leftStick.y = 0;
      snapshot.rightStick.x = 0;
      snapshot.rightStick.y = 0;
      snapshot.leftTrigger = 0;
      snapshot.rightTrigger = 0;
      
      snapshot.pressedButtonsCacheDirty = true;
    }
    
    // Clear event buffer
    const eventsToRelease = this.eventBuffer.drain();
    this.eventPool.releaseMany(eventsToRelease);
    
    // Reset drop statistics in development
    if (this.runtime.enableErrorTracking) {
      this.droppedEventCount = 0;
    }
  }
  
  /**
   * Apply deadzone to analog input
   */
  private applyDeadzone(value: number, deadzone: number): number {
    if (Math.abs(value) < deadzone) {
      return 0;
    }
    
    // Scale the value so that the deadzone becomes 0 and 1 remains 1
    const sign = value < 0 ? -1 : 1;
    const absValue = Math.abs(value);
    return sign * Math.min(1, (absValue - deadzone) / (1 - deadzone));
  }
  
  /**
   * Poll all connected gamepads and detect state changes
   */
  private pollGamepads(): void {
    const currentTime = performance.now();
    
    // Update poll rate tracking
    if (this.lastPollTime > 0) {
      const deltaTime = currentTime - this.lastPollTime;
      this.pollRate = 1000 / deltaTime; // FPS
    }
    this.lastPollTime = currentTime;
    
    const gamepads = navigator.getGamepads();
    
    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      
      if (!gamepad) {
        // Gamepad was disconnected, remove if we had it
        if (this.gamepads.has(i)) {
          this.removeGamepad(i);
        }
        continue;
      }
      
      // Initialize gamepad if we don't have it yet
      if (!this.gamepads.has(i)) {
        this.initializeGamepad(i, gamepad.id, gamepad.mapping);
      }
      
      const snapshot = this.gamepads.get(i)!;
      
      // Poll button states
      for (let buttonIndex = 0; buttonIndex < Math.min(gamepad.buttons.length, GamepadButtons.TOTAL); buttonIndex++) {
        const button = gamepad.buttons[buttonIndex];
        const isPressed = button.pressed || button.value > this.BUTTON_THRESHOLD;
        const currentState = snapshot.buttonStates.get(buttonIndex) || GamepadState.Up;
        
        // Detect state changes
        if (isPressed && (currentState === GamepadState.Up || currentState === GamepadState.JustReleased)) {
          // Button just pressed
          this.bufferButtonEvent(i, buttonIndex, 'buttondown', currentTime, button.value);
        } else if (!isPressed && (currentState === GamepadState.Down || currentState === GamepadState.JustPressed)) {
          // Button just released
          this.bufferButtonEvent(i, buttonIndex, 'buttonup', currentTime, 0);
        }
      }
      
      // Poll analog inputs with deadzone
      const leftStickX = this.applyDeadzone(gamepad.axes[0] || 0, this.deadzone);
      const leftStickY = this.applyDeadzone(gamepad.axes[1] || 0, this.deadzone);
      const rightStickX = this.applyDeadzone(gamepad.axes[2] || 0, this.deadzone);
      const rightStickY = this.applyDeadzone(gamepad.axes[3] || 0, this.deadzone);
      
      // Update analog values
      snapshot.previousLeftStick.x = snapshot.leftStick.x;
      snapshot.previousLeftStick.y = snapshot.leftStick.y;
      snapshot.previousRightStick.x = snapshot.rightStick.x;
      snapshot.previousRightStick.y = snapshot.rightStick.y;
      
      snapshot.leftStick.x = leftStickX;
      snapshot.leftStick.y = leftStickY;
      snapshot.rightStick.x = rightStickX;
      snapshot.rightStick.y = rightStickY;
      
      // Update trigger values with deadzone
      snapshot.leftTrigger = this.applyDeadzone(gamepad.buttons[6]?.value || 0, this.triggerDeadzone);
      snapshot.rightTrigger = this.applyDeadzone(gamepad.buttons[7]?.value || 0, this.triggerDeadzone);
    }
  }
  
  /**
   * Buffer a button event for frame-based processing
   */
  private bufferButtonEvent(
    gamepadIndex: number,
    button: number,
    type: 'buttondown' | 'buttonup',
    timestamp: number,
    value: number
  ): void {
    const pooledEvent = this.eventPool.acquire(
      gamepadIndex,
      button as GamepadButtons,
      type,
      timestamp,
      value
    );
    
    const overwrittenEvent = this.eventBuffer.push(pooledEvent);
    
    if (overwrittenEvent) {
      // Buffer was full, an event was overwritten
      this.eventPool.release(overwrittenEvent);
      
      if (this.runtime.enableErrorTracking) {
        this.droppedEventCount++;
        
        const now = performance.now();
        if (now - this.lastDropWarningTime > this.DROP_WARNING_THROTTLE_MS) {
          this.logger.warn(
            `Gamepad event buffer overflow! Dropped ${this.droppedEventCount} events. ` +
            `Consider increasing MAX_EVENTS_PER_FRAME or optimizing game loop performance.`
          );
          this.lastDropWarningTime = now;
        }
      }
    }
  }
  
  /**
   * Update gamepad states for the current frame
   */
  update(frameNumber: number): void {
    this.currentFrame = frameNumber;
    
    // Prevent multiple updates per frame
    if (this.lastUpdateFrame === frameNumber) {
      return;
    }
    this.lastUpdateFrame = frameNumber;
    
    if (!this.enabled) return;
    
    // Update state transitions from previous frame first
    this.updateStateTransitions();
    
    // Poll gamepad hardware for current state
    this.pollGamepads();
    
    // Process buffered events
    this.processBufferedEvents();
  }
  
  /**
   * Process all buffered gamepad events
   */
  private processBufferedEvents(): void {
    this.eventBuffer.forEach((event) => {
      const snapshot = this.gamepads.get(event.gamepadIndex);
      if (!snapshot) return;
      
      const currentState = snapshot.buttonStates.get(event.button) || GamepadState.Up;
      
      if (event.type === 'buttondown') {
        // Only transition to JustPressed if button was up
        if (currentState === GamepadState.Up || currentState === GamepadState.JustReleased) {
          snapshot.buttonStates.set(event.button, GamepadState.JustPressed);
          
          // Update bit flags
          if (event.button < GamepadButtons.TOTAL) {
            snapshot.downButtons.set(event.button, true);
            snapshot.justPressedButtons.set(event.button, true);
            snapshot.justReleasedButtons.set(event.button, false);
          }
          
          snapshot.pressedButtonsCacheDirty = true;
          snapshot.buttonsNeedingTransition.add(event.button);
          
          if (this.debugInfoEnabled) {
            this.debugInfoDirty = true;
          }
        }
      } else if (event.type === 'buttonup') {
        // Only transition to JustReleased if button was down
        if (currentState === GamepadState.Down || currentState === GamepadState.JustPressed) {
          snapshot.buttonStates.set(event.button, GamepadState.JustReleased);
          
          // Update bit flags
          if (event.button < GamepadButtons.TOTAL) {
            snapshot.downButtons.set(event.button, false);
            snapshot.justPressedButtons.set(event.button, false);
            snapshot.justReleasedButtons.set(event.button, true);
          }
          
          snapshot.pressedButtonsCacheDirty = true;
          snapshot.buttonsNeedingTransition.add(event.button);
          
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
   * Update state transitions for frame-based queries
   */
  private updateStateTransitions(): void {
    for (const [, snapshot] of this.gamepads) {
      // Only process buttons that actually need state transitions
      for (const button of snapshot.buttonsNeedingTransition) {
        const state = snapshot.buttonStates.get(button);
        if (!state) continue;
        
        if (button >= GamepadButtons.TOTAL) continue;
        
        switch (state) {
          case GamepadState.JustPressed:
            // JustPressed -> Down after one frame
            snapshot.buttonStates.set(button, GamepadState.Down);
            snapshot.justPressedButtons.set(button, false);
            // downButtons remains true
            break;
          case GamepadState.JustReleased:
            // JustReleased -> Up after one frame
            snapshot.buttonStates.set(button, GamepadState.Up);
            snapshot.justReleasedButtons.set(button, false);
            // downButtons already false
            break;
        }
      }
      
      // Clear the transition set after processing
      snapshot.buttonsNeedingTransition.clear();
    }
  }
  
  // =======================================================================
  // Public API - Easy to use query methods
  // =======================================================================
  
  /**
   * Check if a button is currently being held down on a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @param button - GamepadButtons enum value
   * @returns True if the button is currently pressed
   */
  isButtonDown(gamepadIndex: number, button: GamepadButtons): boolean {
    const snapshot = this.gamepads.get(gamepadIndex);
    return snapshot ? snapshot.downButtons.get(button) : false;
  }
  
  /**
   * Check if a button was just pressed this frame on a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @param button - GamepadButtons enum value
   * @returns True if the button was just pressed
   */
  wasButtonJustPressed(gamepadIndex: number, button: GamepadButtons): boolean {
    const snapshot = this.gamepads.get(gamepadIndex);
    return snapshot ? snapshot.justPressedButtons.get(button) : false;
  }
  
  /**
   * Check if a button was just released this frame on a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @param button - GamepadButtons enum value
   * @returns True if the button was just released
   */
  wasButtonJustReleased(gamepadIndex: number, button: GamepadButtons): boolean {
    const snapshot = this.gamepads.get(gamepadIndex);
    return snapshot ? snapshot.justReleasedButtons.get(button) : false;
  }
  
  /**
   * Check if a button is currently up on a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @param button - GamepadButtons enum value
   * @returns True if the button is not pressed
   */
  isButtonUp(gamepadIndex: number, button: GamepadButtons): boolean {
    const snapshot = this.gamepads.get(gamepadIndex);
    return snapshot ? !snapshot.downButtons.get(button) : true;
  }
  
  /**
   * Get the current state of a button on a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @param button - GamepadButtons enum value
   * @returns The current GamepadState
   */
  getButtonState(gamepadIndex: number, button: GamepadButtons): GamepadState {
    const snapshot = this.gamepads.get(gamepadIndex);
    return snapshot ? (snapshot.buttonStates.get(button) || GamepadState.Up) : GamepadState.Up;
  }
  
  /**
   * Check if any button is currently pressed on a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns True if any button is currently down
   */
  isAnyButtonDown(gamepadIndex: number): boolean {
    const snapshot = this.gamepads.get(gamepadIndex);
    return snapshot ? snapshot.downButtons.hasAny() : false;
  }
  
  /**
   * Get all currently pressed buttons on a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Array of button numbers that are currently pressed
   */
  getPressedButtons(gamepadIndex: number): number[] {
    const snapshot = this.gamepads.get(gamepadIndex);
    if (!snapshot) return [];
    
    // Use cached array if available and not dirty
    if (!snapshot.pressedButtonsCacheDirty && snapshot.cachedPressedButtons.length >= 0) {
      return snapshot.cachedPressedButtons;
    }
    
    // Rebuild cache
    snapshot.cachedPressedButtons.length = 0;
    const pressedIndices = snapshot.downButtons.getSetIndices();
    
    for (const button of pressedIndices) {
      snapshot.cachedPressedButtons.push(button);
    }
    
    snapshot.pressedButtonsCacheDirty = false;
    return snapshot.cachedPressedButtons;
  }
  
  /**
   * Get left analog stick position for a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Object with x and y coordinates (-1 to 1)
   */
  getLeftStick(gamepadIndex: number): { x: number; y: number } {
    const snapshot = this.gamepads.get(gamepadIndex);
    return snapshot ? { x: snapshot.leftStick.x, y: snapshot.leftStick.y } : { x: 0, y: 0 };
  }
  
  /**
   * Get right analog stick position for a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Object with x and y coordinates (-1 to 1)
   */
  getRightStick(gamepadIndex: number): { x: number; y: number } {
    const snapshot = this.gamepads.get(gamepadIndex);
    return snapshot ? { x: snapshot.rightStick.x, y: snapshot.rightStick.y } : { x: 0, y: 0 };
  }
  
  /**
   * Get left analog stick delta since last frame for a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Object with x and y deltas
   */
  getLeftStickDelta(gamepadIndex: number): { x: number; y: number } {
    const snapshot = this.gamepads.get(gamepadIndex);
    if (!snapshot) return { x: 0, y: 0 };
    
    return {
      x: snapshot.leftStick.x - snapshot.previousLeftStick.x,
      y: snapshot.leftStick.y - snapshot.previousLeftStick.y
    };
  }
  
  /**
   * Get right analog stick delta since last frame for a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Object with x and y deltas
   */
  getRightStickDelta(gamepadIndex: number): { x: number; y: number } {
    const snapshot = this.gamepads.get(gamepadIndex);
    if (!snapshot) return { x: 0, y: 0 };
    
    return {
      x: snapshot.rightStick.x - snapshot.previousRightStick.x,
      y: snapshot.rightStick.y - snapshot.previousRightStick.y
    };
  }
  
  /**
   * Get left trigger value for a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Trigger value (0 to 1)
   */
  getLeftTrigger(gamepadIndex: number): number {
    const snapshot = this.gamepads.get(gamepadIndex);
    return snapshot ? snapshot.leftTrigger : 0;
  }
  
  /**
   * Get right trigger value for a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Trigger value (0 to 1)
   */
  getRightTrigger(gamepadIndex: number): number {
    const snapshot = this.gamepads.get(gamepadIndex);
    return snapshot ? snapshot.rightTrigger : 0;
  }
  
  /**
   * Check if a gamepad is connected
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns True if the gamepad is connected
   */
  isGamepadConnected(gamepadIndex: number): boolean {
    return this.connectedGamepads.has(gamepadIndex);
  }
  
  /**
   * Get all connected gamepad indices
   * @returns Array of connected gamepad indices
   */
  getConnectedGamepads(): number[] {
    return Array.from(this.connectedGamepads);
  }
  
  /**
   * Get gamepad info for a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Gamepad info object or null if not connected
   */
  getGamepadInfo(gamepadIndex: number): { id: string; mapping: string; connected: boolean } | null {
    const snapshot = this.gamepads.get(gamepadIndex);
    return snapshot ? {
      id: snapshot.id,
      mapping: snapshot.mapping,
      connected: snapshot.connected
    } : null;
  }
  
  // =======================================================================
  // Configuration and utility methods
  // =======================================================================
  
  /**
   * Enable or disable gamepad input processing
   * @param enabled - Whether to process gamepad events
   */
  setEnabled(enabled: boolean): void {
    if (!enabled && this.enabled) {
      this.resetAllGamepads();
    }
    this.enabled = enabled;
  }
  
  /**
   * Check if gamepad input is enabled
   */
  get isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Set the deadzone for analog inputs
   * @param deadzone - Deadzone value (0 to 1)
   */
  setDeadzone(deadzone: number): void {
    this.deadzone = Math.max(0, Math.min(1, deadzone));
  }
  
  /**
   * Get the current deadzone value
   */
  get getDeadzone(): number {
    return this.deadzone;
  }
  
  /**
   * Set the deadzone for trigger inputs
   * @param deadzone - Trigger deadzone value (0 to 1)
   */
  setTriggerDeadzone(deadzone: number): void {
    this.triggerDeadzone = Math.max(0, Math.min(1, deadzone));
  }
  
  /**
   * Get the current trigger deadzone value
   */
  get getTriggerDeadzone(): number {
    return this.triggerDeadzone;
  }
  
  /**
   * Enable or disable debug info generation
   * @param enabled - Whether to generate detailed debug info
   */
  setDebugInfoEnabled(enabled: boolean): void {
    this.debugInfoEnabled = enabled;
    if (!enabled) {
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
   * Get debug information about the current input state
   */
  getDebugInfo(): {
    connectedGamepads: number;
    totalButtons: number;
    bufferedEvents: number;
    currentFrame: number;
    pollRate: number;
    deadzone: number;
    triggerDeadzone: number;
    gamepads?: any[];
  } {
    // Return minimal info if debug is not enabled
    if (!this.debugInfoEnabled) {
      return {
        connectedGamepads: this.connectedGamepads.size,
        totalButtons: 0,
        bufferedEvents: this.eventBuffer.length,
        ...(this.runtime.enableErrorTracking && { droppedEvents: this.droppedEventCount }),
        currentFrame: this.currentFrame,
        pollRate: this.pollRate,
        deadzone: this.deadzone,
        triggerDeadzone: this.triggerDeadzone
      };
    }
    
    // Cache debug info to avoid expensive object creation
    if (this.debugInfoDirty || !this.cachedDebugInfo) {
      const gamepadsInfo = [];
      let totalButtons = 0;
      
      for (const [index, snapshot] of this.gamepads) {
        totalButtons += snapshot.downButtons.getSetCount();
        gamepadsInfo.push({
          index: index,
          id: snapshot.id,
          mapping: snapshot.mapping,
          connected: snapshot.connected,
          pressedButtons: snapshot.downButtons.getSetCount(),
          leftStick: { ...snapshot.leftStick },
          rightStick: { ...snapshot.rightStick },
          leftTrigger: snapshot.leftTrigger,
          rightTrigger: snapshot.rightTrigger,
          bitFlags: {
            downButtons: snapshot.downButtons.getDebugInfo(),
            justPressedButtons: snapshot.justPressedButtons.getDebugInfo(),
            justReleasedButtons: snapshot.justReleasedButtons.getDebugInfo()
          }
        });
      }
      
      this.cachedDebugInfo = {
        connectedGamepads: this.connectedGamepads.size,
        totalButtons: totalButtons,
        bufferedEvents: this.eventBuffer.length,
        ...(this.runtime.enableErrorTracking && { droppedEvents: this.droppedEventCount }),
        currentFrame: this.currentFrame,
        pollRate: this.pollRate,
        deadzone: this.deadzone,
        triggerDeadzone: this.triggerDeadzone,
        gamepads: gamepadsInfo,
        ...(this.runtime.enablePerfTracking && {
          memoryStats: {
            eventPoolStats: this.eventPool.getStats(),
            bufferStats: this.eventBuffer.getDebugInfo()
          }
        })
      };
      this.debugInfoDirty = false;
    }
    
    return this.cachedDebugInfo;
  }
  
  /**
   * Clean up event listeners and resources
   */
  destroy(): void {
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Clear all gamepad states
    this.gamepads.clear();
    this.connectedGamepads.clear();
    
    // Clear event buffer and release events back to pool
    const eventsToRelease = this.eventBuffer.drain();
    this.eventPool.releaseMany(eventsToRelease);
    
    // Reset statistics
    if (this.runtime.enableErrorTracking) {
      this.droppedEventCount = 0;
    }
    
    // Clear debug cache
    this.cachedDebugInfo = null;
    this.debugInfoDirty = true;
    
    this.logger.info("GamepadInput destroyed");
  }
}