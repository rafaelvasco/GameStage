// MouseEvent.ts - Mouse input event data structure

/**
 * Mouse input event data for internal processing
 */
export interface MouseInputEvent {
  button: number;
  type: 'mousedown' | 'mouseup' | 'mousemove' | 'wheel';
  timestamp: number;
  x: number;
  y: number;
  deltaX?: number;
  deltaY?: number;
  deltaZ?: number;
}