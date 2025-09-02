// GamepadButtons.ts - Gamepad button enumeration for input tracking

/**
 * Comprehensive gamepad button enumeration with numeric values for optimal performance
 * Each button has a unique numeric identifier for ultra-fast operations
 * Based on standard gamepad layout (Xbox/PlayStation style)
 */
export const enum GamepadButtons {
  // Face buttons (0-3)
  A = 0,        // Bottom face button (Xbox A, PlayStation X)
  B = 1,        // Right face button (Xbox B, PlayStation Circle)
  X = 2,        // Left face button (Xbox X, PlayStation Square)
  Y = 3,        // Top face button (Xbox Y, PlayStation Triangle)
  
  // Shoulder buttons (4-7)
  LeftBumper = 4,     // L1/LB
  RightBumper = 5,    // R1/RB
  LeftTrigger = 6,    // L2/LT (digital)
  RightTrigger = 7,   // R2/RT (digital)
  
  // Menu/System buttons (8-10)
  Back = 8,           // Back/View/Share button
  Start = 9,          // Start/Menu/Options button
  Home = 10,          // Xbox/PlayStation/Guide button
  
  // Stick clicks (11-12)
  LeftStick = 11,     // L3/LS click
  RightStick = 12,    // R3/RS click
  
  // D-Pad (13-16)
  DPadUp = 13,
  DPadDown = 14,
  DPadLeft = 15,
  DPadRight = 16,
  
  // Total count for validation and array sizing
  TOTAL = 17
}