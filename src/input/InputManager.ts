// InputManager.ts - Centralized input management system for the game engine

import { KeyboardInput } from "./keyboard/KeyboardInput";
import { Keys } from "./keyboard/Keys";
import { KeyState } from "./keyboard/KeyState";
import { MouseInput } from "./mouse/MouseInput";
import { MouseButtons } from "./mouse/MouseButtons";
import { MouseState } from "./mouse/MouseState";
import { GamepadInput } from "./gamepad/GamepadInput";
import { GamepadButtons } from "./gamepad/GamepadButtons";
import { GamepadState } from "./gamepad/GamepadState";
import { Logger, LogColors } from "../utils/Logger";
import { Canvas } from "../graphics/Canvas";

/**
 * Input configuration options
 */
export interface InputConfig {
  /** Whether to enable keyboard input (default: true) */
  keyboard?: boolean;
  /** Whether to enable mouse input (default: true) */
  mouse?: boolean;
  /** Whether to enable gamepad input (default: true) */
  gamepad?: boolean;
  /** Keys to prevent default browser behavior for */
  preventDefaults?: Keys[];
  /** Mouse events to prevent default browser behavior for */
  mousePreventDefaults?: ("mousedown" | "mouseup" | "wheel" | "contextmenu")[];
  /** Gamepad deadzone for analog inputs (default: 0.1) */
  gamepadDeadzone?: number;
  /** Gamepad trigger deadzone (default: 0.05) */
  gamepadTriggerDeadzone?: number;
  /** Whether to enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Centralized input manager singleton that orchestrates all input systems
 *
 * Features:
 * - Singleton pattern for global access
 * - Keyboard input management
 * - Mouse input management
 * - Gamepad input management (up to 4 gamepads)
 * - Centralized configuration and debugging
 * - Integration with game loop timing
 */
export class InputManager {
  private static instance: InputManager | null = null;

  private logger: Logger;
  private keyboard: KeyboardInput | null = null;
  private mouse: MouseInput | null = null;
  private gamepad: GamepadInput | null = null;
  private initialized: boolean = false;
  private enabled: boolean = true;
  private debugMode: boolean = false;

  // Fast validation flags - updated only when state changes
  private keyboardReady: boolean = false;
  private mouseReady: boolean = false;
  private gamepadReady: boolean = false;

  // Performance tracking
  private frameNumber: number = 0;
  private lastUpdateTime: number = 0;
  private updateCount: number = 0;

  // Cached debug info to avoid object creation on every frame
  private cachedDebugInfo: any = null;
  private debugInfoCacheDirty: boolean = true;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Get the singleton instance of InputManager
   */
  static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  /**
   * Initialize the input manager with configuration
   * @param config - Input configuration options
   */
  initialize(config: InputConfig = {}, canvas: Canvas): void {
    if (this.initialized) {
      this.logger.warn("InputManager already initialized");
      return;
    }

    const {
      keyboard = true,
      mouse = true,
      gamepad = true,
      preventDefaults = [],
      mousePreventDefaults = [],
      gamepadDeadzone = 0.1,
      gamepadTriggerDeadzone = 0.05,
      debug = false,
    } = config;

    this.debugMode = debug;

    // Initialize keyboard input if enabled
    if (keyboard) {
      this.keyboard = new KeyboardInput();

      // Set up prevent defaults
      for (const key of preventDefaults) {
        this.keyboard.preventDefault(key);
      }

      // Set debug info enabled based on debug mode
      this.keyboard.setDebugInfoEnabled(debug);

      this.keyboardReady = true;
      this.logger.info(
        "InputManager: Keyboard input enabled",
        LogColors.SUCCESS
      );
    }

    // Initialize mouse input if enabled
    if (mouse) {
      this.mouse = new MouseInput(canvas);

      // Set up prevent defaults
      for (const eventType of mousePreventDefaults) {
        this.mouse.preventDefault(eventType);
      }

      // Set debug info enabled based on debug mode
      this.mouse.setDebugInfoEnabled(debug);

      this.mouseReady = true;
      this.logger.info("InputManager: Mouse input enabled", LogColors.SUCCESS);
    }

    // Initialize gamepad input if enabled
    if (gamepad) {
      this.gamepad = new GamepadInput();

      // Set deadzone configuration
      this.gamepad.setDeadzone(gamepadDeadzone);
      this.gamepad.setTriggerDeadzone(gamepadTriggerDeadzone);

      // Set debug info enabled based on debug mode
      this.gamepad.setDebugInfoEnabled(debug);

      this.gamepadReady = true;
      this.logger.info("InputManager: Gamepad input enabled", LogColors.SUCCESS);
    }

    this.initialized = true;
    this.logger.info("InputManager initialized", LogColors.INFO);

    if (this.debugMode) {
      this.logger.debug("InputManager: Debug mode enabled");
    }
  }

  /**
   * Update all input systems - should be called once per frame
   * @param deltaTime - Time since last frame in milliseconds
   */
  update(_deltaTime: number): void {
    if (!this.initialized || !this.enabled) return;

    this.frameNumber++;
    this.lastUpdateTime = performance.now();
    this.updateCount++;

    // Update keyboard input
    if (this.keyboard) {
      this.keyboard.update(this.frameNumber);
      // Mark debug cache as dirty when keyboard state changes (only if debug mode is enabled)
      if (this.debugMode) {
        this.debugInfoCacheDirty = true;
      }
    }

    // Update mouse input
    if (this.mouse) {
      this.mouse.update(this.frameNumber);
      // Mark debug cache as dirty when mouse state changes (only if debug mode is enabled)
      if (this.debugMode) {
        this.debugInfoCacheDirty = true;
      }
    }

    // Update gamepad input
    if (this.gamepad) {
      this.gamepad.update(this.frameNumber);
      // Mark debug cache as dirty when gamepad state changes (only if debug mode is enabled)
      if (this.debugMode) {
        this.debugInfoCacheDirty = true;
      }
    }

    // Debug logging (throttled)
    if (this.debugMode && this.updateCount % 60 === 0) {
      this.logDebugInfo();
    }
  }

  /**
   * Log debug information about input state (optimized - cached to avoid object creation)
   */
  private logDebugInfo(): void {
    if (!this.debugMode) return;

    // Only rebuild debug info if cache is dirty
    if (this.debugInfoCacheDirty || !this.cachedDebugInfo) {
      this.cachedDebugInfo = {
        frame: this.frameNumber,
        enabled: this.enabled,
        updateTime: this.lastUpdateTime,
      };

      if (this.keyboard) {
        this.cachedDebugInfo.keyboard = this.keyboard.getDebugInfo();
      }

      if (this.mouse) {
        this.cachedDebugInfo.mouse = this.mouse.getDebugInfo();
      }

      if (this.gamepad) {
        this.cachedDebugInfo.gamepad = this.gamepad.getDebugInfo();
      }

      this.debugInfoCacheDirty = false;
    } else {
      // Update only the frequently changing values
      this.cachedDebugInfo.frame = this.frameNumber;
      this.cachedDebugInfo.updateTime = this.lastUpdateTime;
    }

    this.logger.debug("InputManager State:", this.cachedDebugInfo);
  }

  // =======================================================================
  // Keyboard Input API - Proxied to KeyboardInput for convenience
  // =======================================================================

  /**
   * Check if a key is currently being held down
   * @param key - Keys enum value (e.g., Keys.W, Keys.Space)
   * @returns True if the key is currently pressed
   */
  isKeyDown(key: Keys): boolean {
    return this.keyboardReady ? this.keyboard!.isKeyDown(key) : false;
  }

  /**
   * Check if a key was just pressed this frame
   * @param key - Keys enum value (e.g., Keys.W, Keys.Space)
   * @returns True if the key was just pressed
   */
  wasKeyJustPressed(key: Keys): boolean {
    return this.keyboardReady ? this.keyboard!.wasKeyJustPressed(key) : false;
  }

  /**
   * Check if a key was just released this frame
   * @param key - Keys enum value (e.g., Keys.W, Keys.Space)
   * @returns True if the key was just released
   */
  wasKeyJustReleased(key: Keys): boolean {
    return this.keyboardReady ? this.keyboard!.wasKeyJustReleased(key) : false;
  }

  /**
   * Check if a key is currently up (not pressed)
   * @param key - Keys enum value (e.g., Keys.W, Keys.Space)
   * @returns True if the key is not pressed
   */
  isKeyUp(key: Keys): boolean {
    return this.keyboardReady ? this.keyboard!.isKeyUp(key) : true;
  }

  /**
   * Check if any key is currently pressed
   * @returns True if any key is currently down
   */
  isAnyKeyDown(): boolean {
    return this.keyboardReady ? this.keyboard!.isAnyKeyDown() : false;
  }

  /**
   * Get all currently pressed keys
   * @returns Array of key codes that are currently pressed
   */
  getPressedKeys(): string[] {
    return this.keyboardReady ? this.keyboard!.getPressedKeys() : [];
  }

  /**
   * Get the current state of a key
   * @param key - Keys enum value (e.g., Keys.W, Keys.Space)
   * @returns The current KeyState
   */
  getKeyState(key: Keys): KeyState {
    return this.keyboardReady ? this.keyboard!.getKeyState(key) : KeyState.Up;
  }

  // =======================================================================
  // Modifier Key Properties
  // =======================================================================

  /**
   * Check if Shift key is pressed
   */
  get isShiftDown(): boolean {
    return this.keyboardReady ? this.keyboard!.isShiftDown : false;
  }

  /**
   * Check if Control key is pressed
   */
  get isControlDown(): boolean {
    return this.keyboardReady ? this.keyboard!.isControlDown : false;
  }

  /**
   * Check if Alt key is pressed
   */
  get isAltDown(): boolean {
    return this.keyboardReady ? this.keyboard!.isAltDown : false;
  }

  /**
   * Check if Meta key (Cmd/Windows key) is pressed
   */
  get isMetaDown(): boolean {
    return this.keyboardReady ? this.keyboard!.isMetaDown : false;
  }

  // =======================================================================
  // Mouse Input API - Proxied to MouseInput for convenience
  // =======================================================================

  /**
   * Check if a mouse button is currently being held down
   * @param button - MouseButtons enum value (e.g., MouseButtons.Left, MouseButtons.Right)
   * @returns True if the button is currently pressed
   */
  isButtonDown(button: MouseButtons): boolean {
    return this.mouseReady ? this.mouse!.isButtonDown(button) : false;
  }

  /**
   * Check if a mouse button was just pressed this frame
   * @param button - MouseButtons enum value (e.g., MouseButtons.Left, MouseButtons.Right)
   * @returns True if the button was just pressed
   */
  wasButtonJustPressed(button: MouseButtons): boolean {
    return this.mouseReady ? this.mouse!.wasButtonJustPressed(button) : false;
  }

  /**
   * Check if a mouse button was just released this frame
   * @param button - MouseButtons enum value (e.g., MouseButtons.Left, MouseButtons.Right)
   * @returns True if the button was just released
   */
  wasButtonJustReleased(button: MouseButtons): boolean {
    return this.mouseReady ? this.mouse!.wasButtonJustReleased(button) : false;
  }

  /**
   * Check if a mouse button is currently up (not pressed)
   * @param button - MouseButtons enum value (e.g., MouseButtons.Left, MouseButtons.Right)
   * @returns True if the button is not pressed
   */
  isButtonUp(button: MouseButtons): boolean {
    return this.mouseReady ? this.mouse!.isButtonUp(button) : true;
  }

  /**
   * Get the current state of a mouse button
   * @param button - MouseButtons enum value (e.g., MouseButtons.Left, MouseButtons.Right)
   * @returns The current MouseState
   */
  getButtonState(button: MouseButtons): MouseState {
    return this.mouseReady ? this.mouse!.getButtonState(button) : MouseState.Up;
  }

  /**
   * Check if any mouse button is currently pressed
   * @returns True if any button is currently down
   */
  isAnyButtonDown(): boolean {
    return this.mouseReady ? this.mouse!.isAnyButtonDown() : false;
  }

  /**
   * Get all currently pressed mouse buttons
   * @returns Array of button numbers that are currently pressed
   */
  getPressedButtons(): number[] {
    return this.mouseReady ? this.mouse!.getPressedButtons() : [];
  }

  /**
   * Get current mouse position (in canvas coordinates)
   * @returns Object with x and y coordinates
   */
  getMousePosition(): { x: number; y: number } {
    return this.mouseReady ? this.mouse!.getPosition() : { x: 0, y: 0 };
  }

  /**
   * Get mouse position delta since last frame
   * @returns Object with x and y deltas
   */
  getMousePositionDelta(): { x: number; y: number } {
    return this.mouseReady ? this.mouse!.getPositionDelta() : { x: 0, y: 0 };
  }

  /**
   * Get current mouse wheel delta
   * @returns Object with x, y, and z deltas
   */
  getMouseWheelDelta(): { x: number; y: number; z: number } {
    return this.mouseReady ? this.mouse!.getWheelDelta() : { x: 0, y: 0, z: 0 };
  }

  /**
   * Get current mouse X position (in canvas coordinates)
   * @returns X coordinate
   */
  get mouseX(): number {
    return this.mouseReady ? this.mouse!.x : 0;
  }

  /**
   * Get current mouse Y position (in canvas coordinates)
   * @returns Y coordinate
   */
  get mouseY(): number {
    return this.mouseReady ? this.mouse!.y : 0;
  }

  /**
   * Get mouse X delta since last frame
   * @returns X delta
   */
  get mouseDeltaX(): number {
    return this.mouseReady ? this.mouse!.deltaX : 0;
  }

  /**
   * Get mouse Y delta since last frame
   * @returns Y delta
   */
  get mouseDeltaY(): number {
    return this.mouseReady ? this.mouse!.deltaY : 0;
  }

  /**
   * Get mouse wheel X delta
   * @returns Wheel X delta
   */
  get mouseWheelX(): number {
    return this.mouseReady ? this.mouse!.wheelX : 0;
  }

  /**
   * Get mouse wheel Y delta
   * @returns Wheel Y delta
   */
  get mouseWheelY(): number {
    return this.mouseReady ? this.mouse!.wheelY : 0;
  }

  // =======================================================================
  // Gamepad Input API - Proxied to GamepadInput for convenience
  // =======================================================================

  /**
   * Check if a gamepad button is currently being held down
   * @param gamepadIndex - Gamepad index (0-3)
   * @param button - GamepadButtons enum value
   * @returns True if the button is currently pressed
   */
  isGamepadButtonDown(gamepadIndex: number, button: GamepadButtons): boolean {
    return this.gamepadReady ? this.gamepad!.isButtonDown(gamepadIndex, button) : false;
  }

  /**
   * Check if a gamepad button was just pressed this frame
   * @param gamepadIndex - Gamepad index (0-3)
   * @param button - GamepadButtons enum value
   * @returns True if the button was just pressed
   */
  wasGamepadButtonJustPressed(gamepadIndex: number, button: GamepadButtons): boolean {
    return this.gamepadReady ? this.gamepad!.wasButtonJustPressed(gamepadIndex, button) : false;
  }

  /**
   * Check if a gamepad button was just released this frame
   * @param gamepadIndex - Gamepad index (0-3)
   * @param button - GamepadButtons enum value
   * @returns True if the button was just released
   */
  wasGamepadButtonJustReleased(gamepadIndex: number, button: GamepadButtons): boolean {
    return this.gamepadReady ? this.gamepad!.wasButtonJustReleased(gamepadIndex, button) : false;
  }

  /**
   * Check if a gamepad button is currently up (not pressed)
   * @param gamepadIndex - Gamepad index (0-3)
   * @param button - GamepadButtons enum value
   * @returns True if the button is not pressed
   */
  isGamepadButtonUp(gamepadIndex: number, button: GamepadButtons): boolean {
    return this.gamepadReady ? this.gamepad!.isButtonUp(gamepadIndex, button) : true;
  }

  /**
   * Get the current state of a gamepad button
   * @param gamepadIndex - Gamepad index (0-3)
   * @param button - GamepadButtons enum value
   * @returns The current GamepadState
   */
  getGamepadButtonState(gamepadIndex: number, button: GamepadButtons): GamepadState {
    return this.gamepadReady ? this.gamepad!.getButtonState(gamepadIndex, button) : GamepadState.Up;
  }

  /**
   * Check if any gamepad button is currently pressed
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns True if any button is currently down
   */
  isAnyGamepadButtonDown(gamepadIndex: number): boolean {
    return this.gamepadReady ? this.gamepad!.isAnyButtonDown(gamepadIndex) : false;
  }

  /**
   * Get all currently pressed gamepad buttons
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Array of button numbers that are currently pressed
   */
  getGamepadPressedButtons(gamepadIndex: number): number[] {
    return this.gamepadReady ? this.gamepad!.getPressedButtons(gamepadIndex) : [];
  }

  /**
   * Get left analog stick position for a gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Object with x and y coordinates (-1 to 1)
   */
  getGamepadLeftStick(gamepadIndex: number): { x: number; y: number } {
    return this.gamepadReady ? this.gamepad!.getLeftStick(gamepadIndex) : { x: 0, y: 0 };
  }

  /**
   * Get right analog stick position for a gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Object with x and y coordinates (-1 to 1)
   */
  getGamepadRightStick(gamepadIndex: number): { x: number; y: number } {
    return this.gamepadReady ? this.gamepad!.getRightStick(gamepadIndex) : { x: 0, y: 0 };
  }

  /**
   * Get left analog stick delta since last frame for a gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Object with x and y deltas
   */
  getGamepadLeftStickDelta(gamepadIndex: number): { x: number; y: number } {
    return this.gamepadReady ? this.gamepad!.getLeftStickDelta(gamepadIndex) : { x: 0, y: 0 };
  }

  /**
   * Get right analog stick delta since last frame for a gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Object with x and y deltas
   */
  getGamepadRightStickDelta(gamepadIndex: number): { x: number; y: number } {
    return this.gamepadReady ? this.gamepad!.getRightStickDelta(gamepadIndex) : { x: 0, y: 0 };
  }

  /**
   * Get left trigger value for a gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Trigger value (0 to 1)
   */
  getGamepadLeftTrigger(gamepadIndex: number): number {
    return this.gamepadReady ? this.gamepad!.getLeftTrigger(gamepadIndex) : 0;
  }

  /**
   * Get right trigger value for a gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Trigger value (0 to 1)
   */
  getGamepadRightTrigger(gamepadIndex: number): number {
    return this.gamepadReady ? this.gamepad!.getRightTrigger(gamepadIndex) : 0;
  }

  /**
   * Check if a gamepad is connected
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns True if the gamepad is connected
   */
  isGamepadConnected(gamepadIndex: number): boolean {
    return this.gamepadReady ? this.gamepad!.isGamepadConnected(gamepadIndex) : false;
  }

  /**
   * Get all connected gamepad indices
   * @returns Array of connected gamepad indices
   */
  getConnectedGamepads(): number[] {
    return this.gamepadReady ? this.gamepad!.getConnectedGamepads() : [];
  }

  /**
   * Get gamepad info for a specific gamepad
   * @param gamepadIndex - Gamepad index (0-3)
   * @returns Gamepad info object or null if not connected
   */
  getGamepadInfo(gamepadIndex: number): { id: string; mapping: string; connected: boolean } | null {
    return this.gamepadReady ? this.gamepad!.getGamepadInfo(gamepadIndex) : null;
  }

  // =======================================================================
  // Input System Management
  // =======================================================================

  /**
   * Enable or disable all input processing
   * @param enabled - Whether to process input events
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (this.keyboard) {
      this.keyboard.setEnabled(enabled);
    }

    if (this.mouse) {
      this.mouse.setEnabled(enabled);
    }

    if (this.gamepad) {
      this.gamepad.setEnabled(enabled);
    }

    // Mark debug cache as dirty when state changes (only if debug mode is enabled)
    if (this.debugMode) {
      this.debugInfoCacheDirty = true;
    }

    this.logger.info(`InputManager ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Check if input processing is enabled
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable keyboard input specifically
   * @param enabled - Whether to process keyboard events
   */
  setKeyboardEnabled(enabled: boolean): void {
    if (this.keyboard) {
      this.keyboard.setEnabled(enabled);
      this.keyboardReady = enabled; // Update fast flag
      this.logger.info(`Keyboard input ${enabled ? "enabled" : "disabled"}`);
    }
  }

  /**
   * Check if keyboard input is available and enabled
   */
  get isKeyboardEnabled(): boolean {
    return this.keyboardReady;
  }

  /**
   * Enable or disable mouse input specifically
   * @param enabled - Whether to process mouse events
   */
  setMouseEnabled(enabled: boolean): void {
    if (this.mouse) {
      this.mouse.setEnabled(enabled);
      this.mouseReady = enabled; // Update fast flag
      this.logger.info(`Mouse input ${enabled ? "enabled" : "disabled"}`);
    }
  }

  /**
   * Check if mouse input is available and enabled
   */
  get isMouseEnabled(): boolean {
    return this.mouseReady;
  }

  /**
   * Enable or disable gamepad input specifically
   * @param enabled - Whether to process gamepad events
   */
  setGamepadEnabled(enabled: boolean): void {
    if (this.gamepad) {
      this.gamepad.setEnabled(enabled);
      this.gamepadReady = enabled; // Update fast flag
      this.logger.info(`Gamepad input ${enabled ? "enabled" : "disabled"}`);
    }
  }

  /**
   * Check if gamepad input is available and enabled
   */
  get isGamepadEnabled(): boolean {
    return this.gamepadReady;
  }

  /**
   * Set the deadzone for gamepad analog inputs
   * @param deadzone - Deadzone value (0 to 1)
   */
  setGamepadDeadzone(deadzone: number): void {
    if (this.gamepadReady) {
      this.gamepad!.setDeadzone(deadzone);
    }
  }

  /**
   * Set the deadzone for gamepad trigger inputs
   * @param deadzone - Trigger deadzone value (0 to 1)
   */
  setGamepadTriggerDeadzone(deadzone: number): void {
    if (this.gamepadReady) {
      this.gamepad!.setTriggerDeadzone(deadzone);
    }
  }

  /**
   * Add a key to the prevent default list
   * @param key - Keys enum value to prevent default behavior for
   */
  preventDefault(key: Keys): void {
    if (this.keyboardReady) {
      this.keyboard!.preventDefault(key);
    }
  }

  /**
   * Remove a key from the prevent default list
   * @param key - Keys enum value to stop preventing default behavior for
   */
  allowDefault(key: Keys): void {
    if (this.keyboardReady) {
      this.keyboard!.allowDefault(key);
    }
  }

  /**
   * Clear all preventDefault settings
   */
  clearPreventDefaults(): void {
    if (this.keyboardReady) {
      this.keyboard!.clearPreventDefaults();
    }
  }

  /**
   * Add a mouse event type to the prevent default list
   * @param eventType - Event type to prevent default behavior for
   */
  preventMouseDefault(
    eventType: "mousedown" | "mouseup" | "wheel" | "contextmenu"
  ): void {
    if (this.mouseReady) {
      this.mouse!.preventDefault(eventType);
    }
  }

  /**
   * Remove a mouse event type from the prevent default list
   * @param eventType - Event type to stop preventing default behavior for
   */
  allowMouseDefault(
    eventType: "mousedown" | "mouseup" | "wheel" | "contextmenu"
  ): void {
    if (this.mouseReady) {
      this.mouse!.allowDefault(eventType);
    }
  }

  /**
   * Clear all mouse preventDefault settings
   */
  clearMousePreventDefaults(): void {
    if (this.mouseReady) {
      this.mouse!.clearPreventDefaults();
    }
  }

  // =======================================================================
  // Utility and Helper Methods
  // =======================================================================

  /**
   * Check if any of the specified keys is pressed (optimized with bit flags)
   * @param keys - Array of Keys enum values to check
   * @returns True if any of the keys is pressed
   */
  isAnyKeyDown_Multi(keys: Keys[]): boolean {
    if (!this.keyboardReady || !this.keyboard) return false;

    // Use bit flag optimization for better performance
    const downKeys = (this.keyboard as any).downKeys;

    if (downKeys && typeof downKeys.hasAnyOf === "function") {
      return downKeys.hasAnyOf(keys);
    }

    // Fallback to original implementation
    return keys.some((key) => this.isKeyDown(key));
  }

  /**
   * Check if all of the specified keys are pressed (optimized with bit flags)
   * @param keys - Array of Keys enum values to check
   * @returns True if all keys are pressed
   */
  areAllKeysDown(keys: Keys[]): boolean {
    if (!this.keyboardReady || !this.keyboard) return false;

    // Use bit flag optimization for better performance
    const downKeys = (this.keyboard as any).downKeys;

    if (downKeys && typeof downKeys.hasAllOf === "function") {
      return downKeys.hasAllOf(keys);
    }

    // Fallback to original implementation
    return keys.every((key) => this.isKeyDown(key));
  }

  /**
   * Check if any of the specified keys was just pressed (optimized with bit flags)
   * @param keys - Array of Keys enum values to check
   * @returns True if any of the keys was just pressed
   */
  wasAnyKeyJustPressed(keys: Keys[]): boolean {
    if (!this.keyboardReady || !this.keyboard) return false;

    // Use bit flag optimization for better performance
    const justPressedKeys = (this.keyboard as any).justPressedKeys;

    if (justPressedKeys && typeof justPressedKeys.hasAnyOf === "function") {
      return justPressedKeys.hasAnyOf(keys);
    }

    // Fallback to original implementation
    return keys.some((key) => this.wasKeyJustPressed(key));
  }

  /**
   * Get comprehensive debug information (can be disabled for performance)
   */
  getDebugInfo(): {
    initialized: boolean;
    enabled: boolean;
    frameNumber: number;
    updateCount: number;
    lastUpdateTime: number;
    debugMode: boolean;
    keyboard?: {
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
    };
    mouse?: {
      totalButtons: number;
      pressedButtons: number;
      bufferedEvents: number;
      currentFrame: number;
      position: { x: number; y: number };
      positionDelta: { x: number; y: number };
      wheelDelta: { x: number; y: number; z: number };
      bitFlags?: {
        downButtons: any;
        justPressedButtons: any;
        justReleasedButtons: any;
      };
      cacheStats?: {
        pressedButtonsCacheDirty: boolean;
        cachedPressedButtonsLength: number;
      };
    };
    gamepad?: {
      connectedGamepads: number;
      totalButtons: number;
      bufferedEvents: number;
      currentFrame: number;
      pollRate: number;
      deadzone: number;
      triggerDeadzone: number;
      gamepads?: any[];
    };
  } {
    // Return minimal info if debug mode is disabled
    if (!this.debugMode) {
      return {
        initialized: this.initialized,
        enabled: this.enabled,
        frameNumber: this.frameNumber,
        updateCount: this.updateCount,
        lastUpdateTime: this.lastUpdateTime,
        debugMode: this.debugMode,
      };
    }

    const info = {
      initialized: this.initialized,
      enabled: this.enabled,
      frameNumber: this.frameNumber,
      updateCount: this.updateCount,
      lastUpdateTime: this.lastUpdateTime,
      debugMode: this.debugMode,
      keyboard: this.keyboard ? this.keyboard.getDebugInfo() : undefined,
      mouse: this.mouse ? this.mouse.getDebugInfo() : undefined,
      gamepad: this.gamepad ? this.gamepad.getDebugInfo() : undefined,
    };

    return info;
  }

  /**
   * Enable or disable debug mode
   * @param debug - Whether to enable debug logging
   */
  setDebugMode(debug: boolean): void {
    this.debugMode = debug;

    // Propagate debug mode to keyboard input
    if (this.keyboard) {
      this.keyboard.setDebugInfoEnabled(debug);
    }

    // Propagate debug mode to mouse input
    if (this.mouse) {
      this.mouse.setDebugInfoEnabled(debug);
    }

    // Propagate debug mode to gamepad input
    if (this.gamepad) {
      this.gamepad.setDebugInfoEnabled(debug);
    }

    if (debug) {
      this.debugInfoCacheDirty = true;
    } else {
      // Clear debug cache when disabling debug mode to free memory
      this.cachedDebugInfo = null;
      this.debugInfoCacheDirty = true;
    }

    this.logger.info(
      `InputManager debug mode ${debug ? "enabled" : "disabled"}`
    );
  }

  /**
   * Get current frame number
   */
  get currentFrame(): number {
    return this.frameNumber;
  }

  /**
   * Check if the input manager is initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clean up all input systems and resources
   */
  destroy(): void {
    if (this.keyboard) {
      this.keyboard.destroy();
      this.keyboard = null;
    }

    if (this.mouse) {
      this.mouse.destroy();
      this.mouse = null;
    }

    if (this.gamepad) {
      this.gamepad.destroy();
      this.gamepad = null;
    }

    this.initialized = false;
    this.enabled = false;
    this.keyboardReady = false;
    this.mouseReady = false;
    this.gamepadReady = false;

    // Clear debug cache
    this.cachedDebugInfo = null;
    this.debugInfoCacheDirty = true;

    this.logger.info("InputManager destroyed");

    // Reset singleton instance
    InputManager.instance = null;
  }
}
