// KeyMapping.ts - High-performance key mapping system

import { Keys } from "./Keys";

// =============================================================================
// ENUM TO KEYCODE MAPPING - Convert Keys enum to browser KeyboardEvent.code
// =============================================================================

/**
 * Ultra-fast array-based mapping from Keys enum to browser key codes
 * Array access is the fastest lookup mechanism in V8
 */
const ENUM_TO_KEYCODE: readonly string[] = [
  // Letters (0-25)
  'KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyH', 'KeyI', 'KeyJ',
  'KeyK', 'KeyL', 'KeyM', 'KeyN', 'KeyO', 'KeyP', 'KeyQ', 'KeyR', 'KeyS', 'KeyT',
  'KeyU', 'KeyV', 'KeyW', 'KeyX', 'KeyY', 'KeyZ',
  
  // Numbers (26-35)
  'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4',
  'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
  
  // Function keys (36-47)
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
  'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  
  // Arrow keys (48-51)
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  
  // Special keys (52-63)
  'Space', 'Enter', 'Escape', 'Tab',
  'Backspace', 'Delete', 'Insert',
  'Home', 'End', 'PageUp', 'PageDown',
  
  // Modifier keys (64-71)
  'ShiftLeft', 'ShiftRight',
  'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight',
  
  // Punctuation (72-82)
  'Minus', 'Equal', 'BracketLeft', 'BracketRight',
  'Backslash', 'Semicolon', 'Quote', 'Comma',
  'Period', 'Slash', 'Backquote',
  
  // Numpad (83-98)
  'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4',
  'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9',
  'NumpadDecimal', 'NumpadEnter', 'NumpadAdd', 'NumpadSubtract',
  'NumpadMultiply', 'NumpadDivide',
  
  // Lock keys (99-101)
  'CapsLock', 'NumLock', 'ScrollLock',
  
  // Additional keys (102-104)
  'PrintScreen', 'Pause', 'ContextMenu'
] as const;

// =============================================================================
// KEYCODE TO ENUM MAPPING - Convert browser key codes to Keys enum
// =============================================================================

/**
 * Fast reverse lookup: browser key code -> Keys enum
 * Object property access optimized by V8 hidden classes
 */
const KEYCODE_TO_ENUM: Readonly<Record<string, Keys>> = {
  // Letters
  'KeyA': Keys.A, 'KeyB': Keys.B, 'KeyC': Keys.C, 'KeyD': Keys.D, 'KeyE': Keys.E,
  'KeyF': Keys.F, 'KeyG': Keys.G, 'KeyH': Keys.H, 'KeyI': Keys.I, 'KeyJ': Keys.J,
  'KeyK': Keys.K, 'KeyL': Keys.L, 'KeyM': Keys.M, 'KeyN': Keys.N, 'KeyO': Keys.O,
  'KeyP': Keys.P, 'KeyQ': Keys.Q, 'KeyR': Keys.R, 'KeyS': Keys.S, 'KeyT': Keys.T,
  'KeyU': Keys.U, 'KeyV': Keys.V, 'KeyW': Keys.W, 'KeyX': Keys.X, 'KeyY': Keys.Y, 'KeyZ': Keys.Z,
  
  // Numbers
  'Digit0': Keys.Digit0, 'Digit1': Keys.Digit1, 'Digit2': Keys.Digit2, 'Digit3': Keys.Digit3, 'Digit4': Keys.Digit4,
  'Digit5': Keys.Digit5, 'Digit6': Keys.Digit6, 'Digit7': Keys.Digit7, 'Digit8': Keys.Digit8, 'Digit9': Keys.Digit9,
  
  // Function keys
  'F1': Keys.F1, 'F2': Keys.F2, 'F3': Keys.F3, 'F4': Keys.F4, 'F5': Keys.F5, 'F6': Keys.F6,
  'F7': Keys.F7, 'F8': Keys.F8, 'F9': Keys.F9, 'F10': Keys.F10, 'F11': Keys.F11, 'F12': Keys.F12,
  
  // Arrow keys
  'ArrowUp': Keys.ArrowUp, 'ArrowDown': Keys.ArrowDown, 'ArrowLeft': Keys.ArrowLeft, 'ArrowRight': Keys.ArrowRight,
  
  // Special keys
  'Space': Keys.Space, 'Enter': Keys.Enter, 'Escape': Keys.Escape, 'Tab': Keys.Tab,
  'Backspace': Keys.Backspace, 'Delete': Keys.Delete, 'Insert': Keys.Insert,
  'Home': Keys.Home, 'End': Keys.End, 'PageUp': Keys.PageUp, 'PageDown': Keys.PageDown,
  
  // Modifier keys
  'ShiftLeft': Keys.ShiftLeft, 'ShiftRight': Keys.ShiftRight,
  'ControlLeft': Keys.ControlLeft, 'ControlRight': Keys.ControlRight,
  'AltLeft': Keys.AltLeft, 'AltRight': Keys.AltRight,
  'MetaLeft': Keys.MetaLeft, 'MetaRight': Keys.MetaRight,
  
  // Punctuation
  'Minus': Keys.Minus, 'Equal': Keys.Equal, 'BracketLeft': Keys.BracketLeft, 'BracketRight': Keys.BracketRight,
  'Backslash': Keys.Backslash, 'Semicolon': Keys.Semicolon, 'Quote': Keys.Quote, 'Comma': Keys.Comma,
  'Period': Keys.Period, 'Slash': Keys.Slash, 'Backquote': Keys.Backquote,
  
  // Numpad
  'Numpad0': Keys.Numpad0, 'Numpad1': Keys.Numpad1, 'Numpad2': Keys.Numpad2, 'Numpad3': Keys.Numpad3, 'Numpad4': Keys.Numpad4,
  'Numpad5': Keys.Numpad5, 'Numpad6': Keys.Numpad6, 'Numpad7': Keys.Numpad7, 'Numpad8': Keys.Numpad8, 'Numpad9': Keys.Numpad9,
  'NumpadDecimal': Keys.NumpadDecimal, 'NumpadEnter': Keys.NumpadEnter, 'NumpadAdd': Keys.NumpadAdd, 'NumpadSubtract': Keys.NumpadSubtract,
  'NumpadMultiply': Keys.NumpadMultiply, 'NumpadDivide': Keys.NumpadDivide,
  
  // Lock keys
  'CapsLock': Keys.CapsLock, 'NumLock': Keys.NumLock, 'ScrollLock': Keys.ScrollLock,
  
  // Additional keys
  'PrintScreen': Keys.PrintScreen, 'Pause': Keys.Pause, 'ContextMenu': Keys.ContextMenu
} as const;

// =============================================================================
// PUBLIC API - Fast mapping functions
// =============================================================================

/**
 * Convert Keys enum to browser key code (ultra-fast array access)
 */
export function enumToKeyCode(key: Keys): string {
  return ENUM_TO_KEYCODE[key];
}

/**
 * Convert browser key code to Keys enum (fast object lookup)
 */
export function keyCodeToEnum(keyCode: string): Keys | undefined {
  return KEYCODE_TO_ENUM[keyCode];
}