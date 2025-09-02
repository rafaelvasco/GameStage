// MouseState.ts - Mouse state enumeration for input tracking

/**
 * Mouse button state enumeration for internal tracking
 * Identical to KeyState for consistency
 */
export enum MouseState {
  Up = 0,           // Button is not pressed
  Down = 1,         // Button is currently pressed
  JustPressed = 2,  // Button was just pressed this frame
  JustReleased = 3  // Button was just released this frame
}