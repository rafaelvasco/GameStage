// Keys.ts - Clean enum definition for all keyboard keys

/**
 * Comprehensive keyboard key enumeration with numeric values for optimal performance
 * Each key has a unique numeric identifier for ultra-fast operations
 */
export const enum Keys {
  // Letters (0-25)
  A = 0, B = 1, C = 2, D = 3, E = 4, F = 5, G = 6, H = 7, I = 8, J = 9,
  K = 10, L = 11, M = 12, N = 13, O = 14, P = 15, Q = 16, R = 17, S = 18, T = 19,
  U = 20, V = 21, W = 22, X = 23, Y = 24, Z = 25,
  
  // Numbers (26-35)
  Digit0 = 26, Digit1 = 27, Digit2 = 28, Digit3 = 29, Digit4 = 30,
  Digit5 = 31, Digit6 = 32, Digit7 = 33, Digit8 = 34, Digit9 = 35,
  
  // Function keys (36-47)
  F1 = 36, F2 = 37, F3 = 38, F4 = 39, F5 = 40, F6 = 41,
  F7 = 42, F8 = 43, F9 = 44, F10 = 45, F11 = 46, F12 = 47,
  
  // Arrow keys (48-51)
  ArrowUp = 48, ArrowDown = 49, ArrowLeft = 50, ArrowRight = 51,
  
  // Special keys (52-63)
  Space = 52, Enter = 53, Escape = 54, Tab = 55,
  Backspace = 56, Delete = 57, Insert = 58,
  Home = 59, End = 60, PageUp = 61, PageDown = 62,
  
  // Modifier keys (64-71)
  ShiftLeft = 64, ShiftRight = 65,
  ControlLeft = 66, ControlRight = 67,
  AltLeft = 68, AltRight = 69,
  MetaLeft = 70, MetaRight = 71,
  
  // Punctuation (72-82)
  Minus = 72, Equal = 73, BracketLeft = 74, BracketRight = 75,
  Backslash = 76, Semicolon = 77, Quote = 78, Comma = 79,
  Period = 80, Slash = 81, Backquote = 82,
  
  // Numpad (83-98)
  Numpad0 = 83, Numpad1 = 84, Numpad2 = 85, Numpad3 = 86, Numpad4 = 87,
  Numpad5 = 88, Numpad6 = 89, Numpad7 = 90, Numpad8 = 91, Numpad9 = 92,
  NumpadDecimal = 93, NumpadEnter = 94, NumpadAdd = 95, NumpadSubtract = 96,
  NumpadMultiply = 97, NumpadDivide = 98,
  
  // Lock keys (99-101)
  CapsLock = 99, NumLock = 100, ScrollLock = 101,
  
  // Additional keys (102-104)
  PrintScreen = 102, Pause = 103, ContextMenu = 104,
  
  // Total count for validation and array sizing
  TOTAL = 105
}