// InputTestScene.ts - Interactive test scene for the keyboard input system

import { Scene } from "./Scene";
import { Canvas } from "../graphics/Canvas";
import { Content } from "../content/Content";
import { Color } from "../graphics/Color";
import { Keys } from "../input/keyboard/Keys";
import { logger } from "../utils";

/**
 * Interactive test scene demonstrating keyboard input capabilities
 *
 * Controls:
 * - WASD: Move the square around
 * - Arrow Keys: Alternative movement
 * - Space: Change square color
 * - Enter: Reset position
 * - Shift: Hold for fast movement
 * - Escape: Show/hide debug info
 */
export class InputTestScene extends Scene {
  // Visual elements
  private squareX: number = 0;
  private squareY: number = 0;
  private squareSize: number = 40;
  private squareColor: Color = Color.CYAN;
  private trailPositions: Array<{ x: number; y: number; alpha: number }> = [];

  // Movement and timing
  private moveSpeed: number = 200; // pixels per second
  private fastMoveSpeed: number = 400; // pixels per second when shift is held
  private lastColorChange: number = 0;
  private colorChangeDelay: number = 200; // milliseconds

  // Available colors for cycling
  private colors: Color[] = [
    Color.CYAN,
    Color.RED,
    Color.GREEN,
    Color.YELLOW,
    Color.MAGENTA,
    Color.ORANGE,
    Color.PINK,
    Color.fromHex("#88FF44"), // Lime green
  ];
  private currentColorIndex: number = 0;

  // Debug and status
  private showDebugInfo: boolean = true;
  private debugToggleTime: number = 0;
  private frameCount: number = 0;

  constructor(canvas: Canvas, content: Content) {
    super(canvas, content);

    // Center the square initially
    this.squareX = canvas.width / 2 - this.squareSize / 2;
    this.squareY = canvas.height / 2 - this.squareSize / 2;
  }

  async initialize(): Promise<boolean> {
    // Initialize any resources if needed
    return true;
  }

  update(deltaTime: number): void {
    this.frameCount++;
    const deltaSeconds = deltaTime / 1000;

    // Handle escape key for debug toggle (with debouncing)
    if (this.input.wasKeyJustPressed(Keys.Escape)) {
      const now = performance.now();
      if (now - this.debugToggleTime > 200) {
        this.showDebugInfo = !this.showDebugInfo;
        this.debugToggleTime = now;
      }
    }

    // Handle color change (with debouncing)
    if (this.input.wasKeyJustPressed(Keys.Space)) {
      logger.debug("Space just pressed - changing color");
      const now = performance.now();
      if (now - this.lastColorChange > this.colorChangeDelay) {
        this.cycleColor();
        this.lastColorChange = now;
      }
    }

    // Handle position reset
    if (this.input.wasKeyJustPressed(Keys.Enter)) {
      logger.debug("Enter just pressed - resetting position");
      this.resetPosition();
    }

    // Handle movement
    this.handleMovement(deltaSeconds);

    // Update trail effect
    this.updateTrail();

    // Keep square within bounds
    this.constrainToBounds();
  }

  fixedUpdate(_fixedTimeStep: number): void {
    // Input-based logic that doesn't need fixed timestep updates
    // Most input handling is done in update() for responsiveness
  }

  draw(_interpolationFactor: number): void {
    // Clear background
    this.canvas.fillRect(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      Color.BLACK
    );

    // Draw trail
    this.drawTrail();

    // Draw the main square
    this.canvas.fillRect(
      this.squareX,
      this.squareY,
      this.squareSize,
      this.squareSize,
      this.squareColor
    );

    // Draw border around square
    this.canvas.drawRect(
      this.squareX,
      this.squareY,
      this.squareSize,
      this.squareSize,
      Color.WHITE,
      2
    );

    // Draw UI
    this.drawUI();

    if (this.showDebugInfo) {
      this.drawDebugInfo();
    }
  }

  cleanup(): void {
    // Clean up any resources
    this.trailPositions = [];
  }

  /**
   * Handle movement input
   */
  private handleMovement(deltaSeconds: number): void {
    let moveX = 0;
    let moveY = 0;

    // Determine movement direction from multiple input sources
    if (this.input.isKeyDown(Keys.A) || this.input.isKeyDown(Keys.ArrowLeft)) {
      moveX -= 1;
    }
    if (this.input.isKeyDown(Keys.D) || this.input.isKeyDown(Keys.ArrowRight)) {
      moveX += 1;
    }
    if (this.input.isKeyDown(Keys.W) || this.input.isKeyDown(Keys.ArrowUp)) {
      moveY -= 1;
    }
    if (this.input.isKeyDown(Keys.S) || this.input.isKeyDown(Keys.ArrowDown)) {
      moveY += 1;
    }

    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
      const length = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= length;
      moveY /= length;
    }

    // Apply speed multiplier
    const currentSpeed = this.input.isShiftDown
      ? this.fastMoveSpeed
      : this.moveSpeed;

    // Add to trail if moving
    if (moveX !== 0 || moveY !== 0) {
      this.addTrailPosition();
    }

    // Update position
    this.squareX += moveX * currentSpeed * deltaSeconds;
    this.squareY += moveY * currentSpeed * deltaSeconds;
  }

  /**
   * Cycle through available colors
   */
  private cycleColor(): void {
    this.currentColorIndex = (this.currentColorIndex + 1) % this.colors.length;
    this.squareColor = this.colors[this.currentColorIndex];
  }

  /**
   * Reset square to center position
   */
  private resetPosition(): void {
    this.squareX = this.canvas.width / 2 - this.squareSize / 2;
    this.squareY = this.canvas.height / 2 - this.squareSize / 2;
    this.trailPositions = [];
  }

  /**
   * Keep square within canvas bounds
   */
  private constrainToBounds(): void {
    this.squareX = Math.max(
      0,
      Math.min(this.canvas.width - this.squareSize, this.squareX)
    );
    this.squareY = Math.max(
      0,
      Math.min(this.canvas.height - this.squareSize, this.squareY)
    );
  }

  /**
   * Add current position to trail
   */
  private addTrailPosition(): void {
    this.trailPositions.push({
      x: this.squareX + this.squareSize / 2,
      y: this.squareY + this.squareSize / 2,
      alpha: 1.0,
    });

    // Limit trail length
    if (this.trailPositions.length > 30) {
      this.trailPositions.shift();
    }
  }

  /**
   * Update trail positions and fade
   */
  private updateTrail(): void {
    for (let i = 0; i < this.trailPositions.length; i++) {
      const trail = this.trailPositions[i];
      trail.alpha -= 0.03;
    }

    // Remove faded trail positions
    this.trailPositions = this.trailPositions.filter(
      (trail) => trail.alpha > 0
    );
  }

  /**
   * Draw movement trail
   */
  private drawTrail(): void {
    for (let i = 0; i < this.trailPositions.length; i++) {
      const trail = this.trailPositions[i];
      const size = Math.max(2, trail.alpha * 8);

      // Create color with alpha
      const trailColor = Color.fromRGBA(
        this.squareColor.r,
        this.squareColor.g,
        this.squareColor.b,
        trail.alpha * 0.6
      );

      this.canvas.fillCircle(trail.x, trail.y, size, trailColor);
    }
  }

  /**
   * Draw UI instructions and status
   */
  private drawUI(): void {
    const padding = 20;
    let y = padding;
    const lineHeight = 25;

    // Title
    this.canvas.drawText("Keyboard Input Test", padding, y, Color.WHITE);
    y += lineHeight * 1.5;

    // Instructions
    const instructions = [
      "Controls:",
      "WASD / Arrow Keys - Move square",
      "Space - Change color",
      "Enter - Reset position",
      "Shift - Fast movement",
      "Escape - Toggle debug info",
    ];

    for (const instruction of instructions) {
      this.canvas.drawText(instruction, padding, y, Color.LIGHT_GRAY);
      y += lineHeight;
    }

    // Status info
    y += lineHeight * 0.5;
    const statusInfo = [
      `Position: (${Math.round(this.squareX)}, ${Math.round(this.squareY)})`,
      `Color: ${this.getCurrentColorName()}`,
      `Speed: ${this.input.isShiftDown ? "Fast" : "Normal"}`,
      `Any key down: ${this.input.isAnyKeyDown() ? "Yes" : "No"}`,
    ];

    for (const status of statusInfo) {
      this.canvas.drawText(status, padding, y, Color.YELLOW);
      y += lineHeight;
    }
  }

  /**
   * Draw debug information
   */
  private drawDebugInfo(): void {
    const debugInfo = this.input.getDebugInfo();
    const padding = 20;
    const rightX = this.canvas.width - 300;
    let y = padding;
    const lineHeight = 20;

    // Debug panel background
    this.canvas.fillRect(
      rightX - 10,
      y - 5,
      290,
      200,
      Color.fromRGBA(0, 0, 0, 0.7)
    );
    this.canvas.drawRect(rightX - 10, y - 5, 290, 200, Color.WHITE, 1);

    this.canvas.drawText("Debug Info", rightX, y, Color.CYAN);
    y += lineHeight * 1.5;

    // Input system info
    const debugLines = [
      `Frame: ${debugInfo.frameNumber}`,
      `Input enabled: ${debugInfo.enabled}`,
      `Pressed keys: ${this.input.getPressedKeys().length}`,
      `Shift: ${this.input.isShiftDown}`,
      `Ctrl: ${this.input.isControlDown}`,
      `Alt: ${this.input.isAltDown}`,
      `Meta: ${this.input.isMetaDown}`,
    ];

    for (const line of debugLines) {
      this.canvas.drawText(line, rightX, y, Color.WHITE);
      y += lineHeight;
    }

    // Currently pressed keys
    const pressedKeys = this.input.getPressedKeys();
    if (pressedKeys.length > 0) {
      this.canvas.drawText("Pressed Keys:", rightX, y, Color.YELLOW);
      const keyText = pressedKeys.slice(0, 8).join(", ");
      this.canvas.drawText(keyText, rightX + 110, y, Color.LIGHT_GRAY);
      y += lineHeight;
    }
  }

  /**
   * Get human-readable name for current color
   */
  private getCurrentColorName(): string {
    const colorNames = [
      "Cyan",
      "Red",
      "Green",
      "Yellow",
      "Magenta",
      "Orange",
      "Pink",
      "Lime",
    ];
    return colorNames[this.currentColorIndex] || "Unknown";
  }
}
