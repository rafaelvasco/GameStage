// Input system exports - Clean API for game developers

// Core input manager
export { InputManager, type InputConfig } from "./InputManager";

// Keyboard input system
export { KeyboardInput } from "./keyboard/KeyboardInput";

// Key system
export { Keys } from "./keyboard/Keys";
export { KeyState } from "./keyboard/KeyState";
export { keyCodeToEnum, enumToKeyCode } from "./keyboard/KeyMapping";
export { type KeyEvent } from "./keyboard/KeyEvent";

// Mouse input system
export { MouseInput } from "./mouse/MouseInput";

// Mouse system
export { MouseButtons } from "./mouse/MouseButtons";
export { MouseState } from "./mouse/MouseState";
export type { MouseInputEvent } from "./mouse/MouseEvent";
export { MouseEventPool } from "./mouse/MouseEventPool";

// Gamepad input system
export { GamepadInput } from "./gamepad/GamepadInput";

// Gamepad system
export { GamepadButtons } from "./gamepad/GamepadButtons";
export { GamepadState } from "./gamepad/GamepadState";
export type { GamepadEvent } from "./gamepad/GamepadEvent";
export { GamepadEventPool } from "./gamepad/GamepadEventPool";

// Performance optimization utilities
export { BitFlags } from "./BitFlags";
export { EventPool } from "./EventPool";
export { CircularBuffer } from "./CircularBuffer";

// Import InputManager to fix the reference issue
import { InputManager } from "./InputManager";

// Convenience function to get the input manager instance
export const input = () => InputManager.getInstance();