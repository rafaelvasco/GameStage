// KeyState.ts - Key state enumeration for input tracking

/**
 * Key state enumeration for internal tracking
 */
export enum KeyState {
  Up = 0,           // Key is not pressed
  Down = 1,         // Key is currently pressed
  JustPressed = 2,  // Key was just pressed this frame
  JustReleased = 3  // Key was just released this frame
}