// MouseInput.ts - High-performance mouse input handling with frame-based state tracking

import { MouseState } from "./MouseState";
import { MouseButtons } from "./MouseButtons";
import { Logger, LogColors } from "../../utils/Logger";
import { RuntimeInfo } from "../../utils/RuntimeInfo";
import { BitFlags } from "../BitFlags";
import { type MouseInputEvent } from "./MouseEvent";
import { MouseEventPool } from "./MouseEventPool";
import { CircularBuffer } from "../CircularBuffer";
import { Canvas } from "../../graphics/Canvas";

/**
 * High-performance mouse input manager with frame-based state tracking
 *
 * Features:
 * - Efficient button state tracking using BitFlags
 * - Frame-based state transitions (JustPressed/JustReleased)
 * - Event buffering to prevent missed inputs
 * - Mouse position and wheel delta tracking
 * - Canvas coordinate system integration
 * - Performance-optimized with minimal allocations
 */
export class MouseInput {
  private logger: Logger;

  // Core state tracking (performance-critical) - using bit flags for optimal performance
  private buttonStates: Map<number, MouseState> = new Map();
  private previousButtonStates: Map<number, MouseState> = new Map();

  // Bit flag optimization for common queries
  private downButtons: BitFlags = new BitFlags(MouseButtons.TOTAL);
  private justPressedButtons: BitFlags = new BitFlags(MouseButtons.TOTAL);
  private justReleasedButtons: BitFlags = new BitFlags(MouseButtons.TOTAL);

  // Mouse position tracking (in canvas coordinates)
  private position = { x: 0, y: 0 };
  private previousPosition = { x: 0, y: 0 };
  private positionDelta = { x: 0, y: 0 };

  // Wheel tracking
  private wheelDelta = { x: 0, y: 0, z: 0 };

  // Cached arrays for performance (only rebuilt when dirty)
  private cachedPressedButtons: number[] = [];
  private pressedButtonsCacheDirty: boolean = true;

  // Optimization for state transitions - track only buttons that need transitions
  private buttonsNeedingTransition: Set<number> = new Set();

  // Debug info caching to avoid object creation when debug is disabled
  private debugInfoEnabled: boolean = false;
  private cachedDebugInfo: any = null;
  private debugInfoDirty: boolean = true;

  // Event buffering for frame-based processing (using circular buffer + pooling)
  private eventBuffer: CircularBuffer<MouseInputEvent>;
  private eventPool: MouseEventPool;
  private readonly MAX_EVENTS_PER_FRAME = 64;

  // Development-only event drop tracking (zero overhead in production)
  private droppedEventCount: number = 0;
  private lastDropWarningTime: number = 0;
  private readonly DROP_WARNING_THROTTLE_MS = 1000;
  private runtime: RuntimeInfo;
  private gameStarted: boolean = false;

  // Performance tracking
  private currentFrame: number = 0;
  private lastUpdateFrame: number = -1;

  // Configuration
  private enabled: boolean = true;
  private preventDefaults: Set<string> = new Set();
  private canvas: Canvas;

  constructor(canvas: Canvas) {
    this.canvas = canvas;
    this.logger = Logger.getInstance();
    this.runtime = RuntimeInfo.getInstance();

    // Initialize high-performance event handling
    this.eventBuffer = new CircularBuffer<MouseInputEvent>(
      this.MAX_EVENTS_PER_FRAME
    );
    this.eventPool = MouseEventPool.getInstance();

    this.setupEventListeners();
    this.logger.info(
      "MouseInput initialized with event pooling and circular buffer",
      LogColors.CYAN
    );
  }

  /**
   * Convert screen coordinates to canvas coordinates using Canvas transform system
   */
  private screenToCanvas(
    screenX: number,
    screenY: number
  ): { x: number; y: number } {
    // Get canvas bounding rect for screen-to-canvas conversion
    const rect = this.canvas.canvas.getBoundingClientRect();

    // Convert screen coordinates to canvas pixel coordinates
    const canvasX = (screenX - rect.left) * (this.canvas.width / rect.width);
    const canvasY = (screenY - rect.top) * (this.canvas.height / rect.height);

    // Use Canvas's globalToLocal method to apply transforms
    return this.canvas.globalToLocal(canvasX, canvasY);
  }

  /**
   * Set up DOM event listeners for mouse events
   */
  private setupEventListeners(): void {
    const target = this.canvas.canvas;

    // Mouse button events
    target.addEventListener(
      "mousedown",
      this.handleMouseDown as EventListener,
      { capture: true, passive: false }
    );
    target.addEventListener("mouseup", this.handleMouseUp as EventListener, {
      capture: true,
      passive: false,
    });

    // Mouse movement
    target.addEventListener(
      "mousemove",
      this.handleMouseMove as EventListener,
      { capture: true, passive: true }
    );

    // Mouse wheel
    target.addEventListener("wheel", this.handleMouseWheel as EventListener, {
      capture: true,
      passive: false,
    });

    // Context menu (right-click)
    target.addEventListener("contextmenu", this.handleContextMenu, {
      capture: true,
      passive: false,
    });

    // Handle focus events to reset state when focus is lost
    window.addEventListener("blur", this.handleWindowBlur);
    window.addEventListener("focus", this.handleWindowFocus);

    // Handle visibility change to reset state when tab becomes hidden
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  /**
   * Handle mousedown events
   */
  private handleMouseDown = (event: globalThis.MouseEvent): void => {
    if (!this.enabled) return;

    const button = event.button;

    // Prevent default if configured
    if (this.preventDefaults.has("mousedown")) {
      event.preventDefault();
    }

    // Convert to canvas coordinates
    const canvasPos = this.screenToCanvas(event.clientX, event.clientY);

    // Buffer the event for frame-based processing (using object pool)
    const pooledEvent = this.eventPool.acquire(
      button,
      "mousedown",
      performance.now(),
      false,
      canvasPos.x,
      canvasPos.y
    );
    this.bufferEvent(pooledEvent);
  };

  /**
   * Handle mouseup events
   */
  private handleMouseUp = (event: globalThis.MouseEvent): void => {
    if (!this.enabled) return;

    const button = event.button;

    // Prevent default if configured
    if (this.preventDefaults.has("mouseup")) {
      event.preventDefault();
    }

    // Convert to canvas coordinates
    const canvasPos = this.screenToCanvas(event.clientX, event.clientY);

    // Buffer the event for frame-based processing (using object pool)
    const pooledEvent = this.eventPool.acquire(
      button,
      "mouseup",
      performance.now(),
      false,
      canvasPos.x,
      canvasPos.y
    );
    this.bufferEvent(pooledEvent);
  };

  /**
   * Handle mousemove events
   */
  private handleMouseMove = (event: globalThis.MouseEvent): void => {
    if (!this.enabled) return;

    // Convert to canvas coordinates
    const canvasPos = this.screenToCanvas(event.clientX, event.clientY);

    // Buffer the event for frame-based processing (using object pool)
    const pooledEvent = this.eventPool.acquire(
      -1, // No button for move events
      "mousemove",
      performance.now(),
      false,
      canvasPos.x,
      canvasPos.y
    );
    this.bufferEvent(pooledEvent);
  };

  /**
   * Handle wheel events
   */
  private handleMouseWheel = (event: globalThis.WheelEvent): void => {
    if (!this.enabled) return;

    // Prevent default if configured
    if (this.preventDefaults.has("wheel")) {
      event.preventDefault();
    }

    // Convert to canvas coordinates
    const canvasPos = this.screenToCanvas(event.clientX, event.clientY);

    // Buffer the event for frame-based processing (using object pool)
    const pooledEvent = this.eventPool.acquire(
      -1, // No button for wheel events
      "wheel",
      performance.now(),
      false,
      canvasPos.x,
      canvasPos.y,
      event.deltaX,
      event.deltaY,
      event.deltaZ
    );
    this.bufferEvent(pooledEvent);
  };

  /**
   * Handle context menu events
   */
  private handleContextMenu = (event: Event): void => {
    if (this.preventDefaults.has("contextmenu")) {
      event.preventDefault();
    }
  };

  /**
   * Buffer a mouse event for frame-based processing (with object pooling)
   */
  private bufferEvent(event: MouseInputEvent): void {
    const overwrittenEvent = this.eventBuffer.push(event);

    if (overwrittenEvent) {
      // Buffer was full, an event was overwritten - release it back to pool
      this.eventPool.release(overwrittenEvent);

      // Development-only tracking and warnings (zero overhead in production)
      // Only show warnings after the game has started to avoid initialization noise
      if (this.runtime.enableErrorTracking && this.gameStarted) {
        this.droppedEventCount++;

        // Throttled warning to avoid spam
        const now = performance.now();
        if (now - this.lastDropWarningTime > this.DROP_WARNING_THROTTLE_MS) {
          this.logger.warn(
            `Mouse event buffer overflow! Dropped ${this.droppedEventCount} events. ` +
              `Consider increasing MAX_EVENTS_PER_FRAME or optimizing game loop performance. ` +
              `Buffer size: ${this.MAX_EVENTS_PER_FRAME}, Total dropped: ${this.droppedEventCount}`
          );
          this.lastDropWarningTime = now;
        }
      }
    }
  }

  /**
   * Handle window blur - reset all button states
   */
  private handleWindowBlur = (): void => {
    this.resetAllButtons();
    this.logger.debug("MouseInput: Window blur, resetting all button states");
  };

  /**
   * Handle window focus - clear any stale states
   */
  private handleWindowFocus = (): void => {
    this.resetAllButtons();
    this.logger.debug("MouseInput: Window focus, clearing stale states");
  };

  /**
   * Handle visibility change - reset state when tab becomes hidden
   */
  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.resetAllButtons();
      this.logger.debug("MouseInput: Tab hidden, resetting all button states");
    }
  };

  /**
   * Reset all button states (used when focus is lost)
   */
  private resetAllButtons(): void {
    // Move all currently pressed buttons to released state
    for (const [button, state] of this.buttonStates) {
      if (state === MouseState.Down || state === MouseState.JustPressed) {
        this.buttonStates.set(button, MouseState.JustReleased);

        // Update bit flags
        if (button < MouseButtons.TOTAL) {
          this.downButtons.set(button, false);
          this.justPressedButtons.set(button, false);
          this.justReleasedButtons.set(button, true);
        }

        // Mark button as needing transition next frame
        this.buttonsNeedingTransition.add(button);
      }
    }

    // Clear event buffer and release events back to pool
    const eventsToRelease = this.eventBuffer.drain();
    this.eventPool.releaseMany(eventsToRelease);

    // Clear any remaining buttons in transition set to prevent memory leaks
    this.buttonsNeedingTransition.clear();

    // Reset wheel delta
    this.wheelDelta.x = 0;
    this.wheelDelta.y = 0;
    this.wheelDelta.z = 0;

    // Reset drop statistics in development
    if (this.runtime.enableErrorTracking) {
      this.droppedEventCount = 0;
    }

    // Mark cache as dirty
    this.pressedButtonsCacheDirty = true;
  }

  /**
   * Update mouse states for the current frame
   * This should be called once per frame by the game loop
   */
  update(frameNumber: number): void {
    this.currentFrame = frameNumber;

    // Mark game as started on first update
    if (!this.gameStarted) {
      this.gameStarted = true;
    }

    // Prevent multiple updates per frame
    if (this.lastUpdateFrame === frameNumber) {
      return;
    }
    this.lastUpdateFrame = frameNumber;

    // Reset wheel delta at start of frame
    this.wheelDelta.x = 0;
    this.wheelDelta.y = 0;
    this.wheelDelta.z = 0;

    // Update state transitions from previous frame first
    this.updateStateTransitions();

    // Copy current states to previous for transition detection
    this.previousButtonStates.clear();
    for (const [button, state] of this.buttonStates) {
      this.previousButtonStates.set(button, state);
    }

    // Copy current position to previous
    this.previousPosition.x = this.position.x;
    this.previousPosition.y = this.position.y;

    // Process buffered events
    this.processBufferedEvents();

    // Calculate position delta
    this.positionDelta.x = this.position.x - this.previousPosition.x;
    this.positionDelta.y = this.position.y - this.previousPosition.y;
  }

  /**
   * Process all buffered mouse events (with efficient iteration and object pooling)
   */
  private processBufferedEvents(): void {
    // Process events using circular buffer's efficient iteration
    this.eventBuffer.forEach((event) => {
      if (event.type === "mousedown") {
        const currentState =
          this.buttonStates.get(event.button) || MouseState.Up;

        // Only transition to JustPressed if button was up
        if (
          currentState === MouseState.Up ||
          currentState === MouseState.JustReleased
        ) {
          this.buttonStates.set(event.button, MouseState.JustPressed);

          // Update bit flags
          if (event.button < MouseButtons.TOTAL) {
            this.downButtons.set(event.button, true);
            this.justPressedButtons.set(event.button, true);
            this.justReleasedButtons.set(event.button, false);
          }

          this.pressedButtonsCacheDirty = true;

          // Mark button as needing transition next frame
          this.buttonsNeedingTransition.add(event.button);

          // Mark debug info as dirty if debug is enabled
          if (this.debugInfoEnabled) {
            this.debugInfoDirty = true;
          }
        }
      } else if (event.type === "mouseup") {
        const currentState =
          this.buttonStates.get(event.button) || MouseState.Up;

        // Only transition to JustReleased if button was down
        if (
          currentState === MouseState.Down ||
          currentState === MouseState.JustPressed
        ) {
          this.buttonStates.set(event.button, MouseState.JustReleased);

          // Update bit flags
          if (event.button < MouseButtons.TOTAL) {
            this.downButtons.set(event.button, false);
            this.justPressedButtons.set(event.button, false);
            this.justReleasedButtons.set(event.button, true);
          }

          this.pressedButtonsCacheDirty = true;

          // Mark button as needing transition next frame
          this.buttonsNeedingTransition.add(event.button);

          // Mark debug info as dirty if debug is enabled
          if (this.debugInfoEnabled) {
            this.debugInfoDirty = true;
          }
        }
      } else if (event.type === "mousemove") {
        // Update position
        this.position.x = event.x;
        this.position.y = event.y;
      } else if (event.type === "wheel") {
        // Accumulate wheel delta
        this.wheelDelta.x += event.deltaX || 0;
        this.wheelDelta.y += event.deltaY || 0;
        this.wheelDelta.z += event.deltaZ || 0;
      }
    });

    // Release all processed events back to the pool and clear buffer
    const processedEvents = this.eventBuffer.drain();
    this.eventPool.releaseMany(processedEvents);
  }

  /**
   * Update state transitions for frame-based queries (optimized - only process buttons that need transitions)
   */
  private updateStateTransitions(): void {
    // Only process buttons that actually need state transitions
    for (const button of this.buttonsNeedingTransition) {
      const state = this.buttonStates.get(button);
      if (!state) continue;

      if (button >= MouseButtons.TOTAL) continue;

      switch (state) {
        case MouseState.JustPressed:
          // JustPressed -> Down after one frame
          this.buttonStates.set(button, MouseState.Down);
          this.justPressedButtons.set(button, false);
          // downButtons remains true
          break;
        case MouseState.JustReleased:
          // JustReleased -> Up after one frame
          this.buttonStates.set(button, MouseState.Up);
          this.justReleasedButtons.set(button, false);
          // downButtons already false
          break;
        // Down and Up states remain until changed by events
      }
    }

    // Clear the transition set after processing
    this.buttonsNeedingTransition.clear();
  }

  // =======================================================================
  // Public API - Easy to use query methods
  // =======================================================================

  /**
   * Check if a mouse button is currently being held down
   * @param button - MouseButtons enum value (e.g., MouseButtons.Left, MouseButtons.Right)
   * @returns True if the button is currently pressed
   */
  isButtonDown(button: MouseButtons): boolean {
    return this.downButtons.get(button);
  }

  /**
   * Check if a mouse button was just pressed this frame
   * @param button - MouseButtons enum value (e.g., MouseButtons.Left, MouseButtons.Right)
   * @returns True if the button was just pressed
   */
  wasButtonJustPressed(button: MouseButtons): boolean {
    return this.justPressedButtons.get(button);
  }

  /**
   * Check if a mouse button was just released this frame
   * @param button - MouseButtons enum value (e.g., MouseButtons.Left, MouseButtons.Right)
   * @returns True if the button was just released
   */
  wasButtonJustReleased(button: MouseButtons): boolean {
    return this.justReleasedButtons.get(button);
  }

  /**
   * Check if a mouse button is currently up (not pressed)
   * @param button - MouseButtons enum value (e.g., MouseButtons.Left, MouseButtons.Right)
   * @returns True if the button is not pressed
   */
  isButtonUp(button: MouseButtons): boolean {
    return !this.downButtons.get(button);
  }

  /**
   * Get the current state of a mouse button
   * @param button - MouseButtons enum value (e.g., MouseButtons.Left, MouseButtons.Right)
   * @returns The current MouseState
   */
  getButtonState(button: MouseButtons): MouseState {
    return this.buttonStates.get(button) || MouseState.Up;
  }

  /**
   * Check if any mouse button is currently pressed
   * @returns True if any button is currently down
   */
  isAnyButtonDown(): boolean {
    return this.downButtons.hasAny();
  }

  /**
   * Get all currently pressed buttons
   * @returns Array of button numbers that are currently pressed
   */
  getPressedButtons(): number[] {
    // Use cached array if available and not dirty
    if (
      !this.pressedButtonsCacheDirty &&
      this.cachedPressedButtons.length >= 0
    ) {
      return this.cachedPressedButtons;
    }

    // Rebuild cache
    this.cachedPressedButtons.length = 0;
    const pressedIndices = this.downButtons.getSetIndices();

    for (const button of pressedIndices) {
      this.cachedPressedButtons.push(button);
    }

    this.pressedButtonsCacheDirty = false;
    return this.cachedPressedButtons;
  }

  /**
   * Get current mouse position (in canvas coordinates)
   * @returns Object with x and y coordinates
   */
  getPosition(): { x: number; y: number } {
    return { x: this.position.x, y: this.position.y };
  }

  /**
   * Get mouse position delta since last frame
   * @returns Object with x and y deltas
   */
  getPositionDelta(): { x: number; y: number } {
    return { x: this.positionDelta.x, y: this.positionDelta.y };
  }

  /**
   * Get current mouse wheel delta
   * @returns Object with x, y, and z deltas
   */
  getWheelDelta(): { x: number; y: number; z: number } {
    return { x: this.wheelDelta.x, y: this.wheelDelta.y, z: this.wheelDelta.z };
  }

  /**
   * Get current mouse X position (in canvas coordinates)
   * @returns X coordinate
   */
  get x(): number {
    return this.position.x;
  }

  /**
   * Get current mouse Y position (in canvas coordinates)
   * @returns Y coordinate
   */
  get y(): number {
    return this.position.y;
  }

  /**
   * Get mouse X delta since last frame
   * @returns X delta
   */
  get deltaX(): number {
    return this.positionDelta.x;
  }

  /**
   * Get mouse Y delta since last frame
   * @returns Y delta
   */
  get deltaY(): number {
    return this.positionDelta.y;
  }

  /**
   * Get mouse wheel X delta
   * @returns Wheel X delta
   */
  get wheelX(): number {
    return this.wheelDelta.x;
  }

  /**
   * Get mouse wheel Y delta
   * @returns Wheel Y delta
   */
  get wheelY(): number {
    return this.wheelDelta.y;
  }

  // =======================================================================
  // Configuration and utility methods
  // =======================================================================

  /**
   * Enable or disable mouse input processing
   * @param enabled - Whether to process mouse events
   */
  setEnabled(enabled: boolean): void {
    if (!enabled && this.enabled) {
      // Reset all buttons when disabling
      this.resetAllButtons();
    }
    this.enabled = enabled;
  }

  /**
   * Check if mouse input is enabled
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Add an event type to the prevent default list
   * @param eventType - Event type to prevent default behavior for
   */
  preventDefault(
    eventType: "mousedown" | "mouseup" | "wheel" | "contextmenu"
  ): void {
    this.preventDefaults.add(eventType);
  }

  /**
   * Remove an event type from the prevent default list
   * @param eventType - Event type to stop preventing default behavior for
   */
  allowDefault(
    eventType: "mousedown" | "mouseup" | "wheel" | "contextmenu"
  ): void {
    this.preventDefaults.delete(eventType);
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
  } {
    // Return minimal info if debug is not enabled
    if (!this.debugInfoEnabled) {
      return {
        totalButtons: this.buttonStates.size,
        pressedButtons: this.downButtons.getSetCount(),
        bufferedEvents: this.eventBuffer.length,
        ...(this.runtime.enableErrorTracking && {
          droppedEvents: this.droppedEventCount,
        }),
        currentFrame: this.currentFrame,
        position: { ...this.position },
        positionDelta: { ...this.positionDelta },
        wheelDelta: { ...this.wheelDelta },
        ...(this.runtime.enablePerfTracking && {
          memoryStats: {
            eventPoolStats: this.eventPool.getStats(),
            bufferStats: this.eventBuffer.getDebugInfo(),
          },
        }),
      };
    }

    // Cache debug info to avoid expensive object creation
    if (this.debugInfoDirty || !this.cachedDebugInfo) {
      this.cachedDebugInfo = {
        totalButtons: this.buttonStates.size,
        pressedButtons: this.downButtons.getSetCount(),
        bufferedEvents: this.eventBuffer.length,
        ...(this.runtime.enableErrorTracking && {
          droppedEvents: this.droppedEventCount,
        }),
        currentFrame: this.currentFrame,
        position: { ...this.position },
        positionDelta: { ...this.positionDelta },
        wheelDelta: { ...this.wheelDelta },
        bitFlags: {
          downButtons: this.downButtons.getDebugInfo(),
          justPressedButtons: this.justPressedButtons.getDebugInfo(),
          justReleasedButtons: this.justReleasedButtons.getDebugInfo(),
        },
        cacheStats: {
          pressedButtonsCacheDirty: this.pressedButtonsCacheDirty,
          cachedPressedButtonsLength: this.cachedPressedButtons.length,
        },
        ...(this.runtime.enablePerfTracking && {
          memoryStats: {
            eventPoolStats: this.eventPool.getStats(),
            bufferStats: this.eventBuffer.getDebugInfo(),
          },
        }),
      };
      this.debugInfoDirty = false;
    } else {
      // Update only frequently changing values
      this.cachedDebugInfo.pressedButtons = this.downButtons.getSetCount();
      this.cachedDebugInfo.bufferedEvents = this.eventBuffer.length;
      this.cachedDebugInfo.currentFrame = this.currentFrame;
      this.cachedDebugInfo.position = { ...this.position };
      this.cachedDebugInfo.positionDelta = { ...this.positionDelta };
      this.cachedDebugInfo.wheelDelta = { ...this.wheelDelta };
      this.cachedDebugInfo.cacheStats.pressedButtonsCacheDirty =
        this.pressedButtonsCacheDirty;
      this.cachedDebugInfo.cacheStats.cachedPressedButtonsLength =
        this.cachedPressedButtons.length;
    }

    return this.cachedDebugInfo;
  }

  /**
   * Clean up event listeners and resources
   */
  destroy(): void {
    const target = this.canvas.canvas;

    target.removeEventListener(
      "mousedown",
      this.handleMouseDown as EventListener
    );
    target.removeEventListener("mouseup", this.handleMouseUp as EventListener);
    target.removeEventListener(
      "mousemove",
      this.handleMouseMove as EventListener
    );
    target.removeEventListener("wheel", this.handleMouseWheel as EventListener);
    target.removeEventListener("contextmenu", this.handleContextMenu);

    window.removeEventListener("blur", this.handleWindowBlur);
    window.removeEventListener("focus", this.handleWindowFocus);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );

    this.buttonStates.clear();
    this.previousButtonStates.clear();

    // Clear event buffer and release events back to pool
    const eventsToRelease = this.eventBuffer.drain();
    this.eventPool.releaseMany(eventsToRelease);

    this.preventDefaults.clear();

    // Reset drop statistics in development
    if (this.runtime.enableErrorTracking) {
      this.droppedEventCount = 0;
    }

    // Clear bit flags
    this.downButtons.clear();
    this.justPressedButtons.clear();
    this.justReleasedButtons.clear();

    // Clear cached arrays
    this.cachedPressedButtons.length = 0;
    this.pressedButtonsCacheDirty = true;

    // Clear transition tracking
    this.buttonsNeedingTransition.clear();

    // Clear debug cache
    this.cachedDebugInfo = null;
    this.debugInfoDirty = true;

    this.logger.info("MouseInput destroyed");
  }
}
