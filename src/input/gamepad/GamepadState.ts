// GamepadState.ts - Gamepad button state enumeration for input tracking

/**
 * Gamepad button state enumeration for internal tracking
 * Identical to KeyState and MouseState for consistency
 */
export enum GamepadState {
  Up = 0,           // Button is not pressed
  Down = 1,         // Button is currently pressed
  JustPressed = 2,  // Button was just pressed this frame
  JustReleased = 3  // Button was just released this frame
}