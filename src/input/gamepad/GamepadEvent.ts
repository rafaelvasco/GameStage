// GamepadEvent.ts - Event interface for gamepad input pooling

import { GamepadButtons } from "./GamepadButtons";

/**
 * Internal gamepad event interface for object pooling
 * Used to reduce allocation pressure during high-frequency gamepad polling
 */
export interface GamepadEvent {
  /** The gamepad index (0-3) */
  gamepadIndex: number;
  /** The button that changed */
  button: GamepadButtons;
  /** The event type */
  type: 'buttondown' | 'buttonup' | 'axischange';
  /** Event timestamp */
  timestamp: number;
  /** Button value (0-1 for analog buttons, 0/1 for digital) */
  value: number;
  /** For axis events: the axis index */
  axisIndex?: number;
  /** For axis events: the axis value (-1 to 1) */
  axisValue?: number;
}