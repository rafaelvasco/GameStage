// KeyEvent.ts - Keyboard input event data structure

/**
 * Keyboard input event data for internal processing
 */
export interface KeyEvent {
  code: string;
  type: 'keydown' | 'keyup';
  timestamp: number;
  repeat: boolean;
}