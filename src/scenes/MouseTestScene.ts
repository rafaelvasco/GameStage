// MouseTestScene.ts - Interactive test scene for the mouse input system

import { Scene } from "./Scene";
import { Canvas } from "../graphics/Canvas";
import { Content } from "../content/Content";
import { Color } from "../graphics/Color";
import { MouseButtons } from "../input/mouse/MouseButtons";
import { logger } from "../utils";

/**
 * Interactive test scene demonstrating mouse input capabilities
 *
 * Controls:
 * - Mouse Movement: Move the cursor around
 * - Left Click: Create red circles
 * - Right Click: Create blue circles
 * - Middle Click: Create green circles
 * - Mouse Wheel: Change circle size
 * - Left Click + Drag: Draw line trails
 * - Right Click + Drag: Erase circles
 */
export class MouseTestScene extends Scene {
  // Visual elements
  private circles: Array<{
    x: number;
    y: number;
    radius: number;
    color: Color;
    alpha: number;
    fadeSpeed: number;
  }> = [];
  
  private trails: Array<{
    x: number;
    y: number;
    alpha: number;
  }> = [];

  // Mouse state
  private cursorX: number = 0;
  private cursorY: number = 0;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private currentCircleSize: number = 20;
  private minCircleSize: number = 5;
  private maxCircleSize: number = 50;

  // Interaction settings
  private eraseRadius: number = 30;
  private maxCircles: number = 100;
  private maxTrails: number = 50;

  // Debug and status
  private showDebugInfo: boolean = true;
  private frameCount: number = 0;
  private lastCircleCreate: number = 0;
  private circleCreateDelay: number = 50; // milliseconds

  constructor(canvas: Canvas, content: Content) {
    super(canvas, content);
  }

  async initialize(): Promise<boolean> {
    // Initialize any resources if needed
    return true;
  }

  update(_deltaTime: number): void {
    this.frameCount++;

    // Update cursor position
    this.cursorX = this.input.mouseX;
    this.cursorY = this.input.mouseY;

    // Handle mouse wheel for circle size
    const wheelDelta = this.input.getMouseWheelDelta();
    if (wheelDelta.y !== 0) {
      this.currentCircleSize += wheelDelta.y > 0 ? -2 : 2;
      this.currentCircleSize = Math.max(
        this.minCircleSize,
        Math.min(this.maxCircleSize, this.currentCircleSize)
      );
    }

    // Handle circle creation
    this.handleCircleCreation();

    // Handle dragging and trails
    this.handleDragging();

    // Handle erasing
    this.handleErasing();

    // Update existing circles
    this.updateCircles();

    // Update trails
    this.updateTrails();

    // Limit circle count
    if (this.circles.length > this.maxCircles) {
      this.circles.splice(0, this.circles.length - this.maxCircles);
    }

    // Limit trail count
    if (this.trails.length > this.maxTrails) {
      this.trails.splice(0, this.trails.length - this.maxTrails);
    }
  }

  fixedUpdate(_fixedTimeStep: number): void {
    // Mouse input doesn't need fixed timestep updates
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
    this.drawTrails();

    // Draw circles
    this.drawCircles();

    // Draw cursor
    this.drawCursor();

    // Draw UI
    this.drawUI();

    if (this.showDebugInfo) {
      this.drawDebugInfo();
    }
  }

  cleanup(): void {
    // Clean up any resources
    this.circles = [];
    this.trails = [];
  }

  /**
   * Handle circle creation with mouse buttons
   */
  private handleCircleCreation(): void {
    const now = performance.now();
    
    // Throttle circle creation to prevent spam
    if (now - this.lastCircleCreate < this.circleCreateDelay) {
      return;
    }

    let color: Color | null = null;

    if (this.input.wasButtonJustPressed(MouseButtons.Left)) {
      color = Color.RED;
      logger.debug("Left mouse button pressed - creating red circle");
    } else if (this.input.wasButtonJustPressed(MouseButtons.Right)) {
      color = Color.BLUE;
      logger.debug("Right mouse button pressed - creating blue circle");
    } else if (this.input.wasButtonJustPressed(MouseButtons.Middle)) {
      color = Color.GREEN;
      logger.debug("Middle mouse button pressed - creating green circle");
    }

    if (color) {
      this.createCircle(this.cursorX, this.cursorY, color);
      this.lastCircleCreate = now;
    }
  }

  /**
   * Handle dragging and trail creation
   */
  private handleDragging(): void {
    if (this.input.wasButtonJustPressed(MouseButtons.Left)) {
      this.isDragging = true;
      this.dragStartX = this.cursorX;
      this.dragStartY = this.cursorY;
    }

    if (this.input.wasButtonJustReleased(MouseButtons.Left)) {
      this.isDragging = false;
    }

    if (this.isDragging && this.input.isButtonDown(MouseButtons.Left)) {
      const deltaX = this.input.mouseDeltaX;
      const deltaY = this.input.mouseDeltaY;
      
      // Create trail if mouse is moving
      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        this.addTrailPoint(this.cursorX, this.cursorY);
      }
    }
  }

  /**
   * Handle erasing circles with right click drag
   */
  private handleErasing(): void {
    if (this.input.isButtonDown(MouseButtons.Right)) {
      const mouseDelta = this.input.getMousePositionDelta();
      
      // Erase circles within radius if mouse is moving
      if (Math.abs(mouseDelta.x) > 0.5 || Math.abs(mouseDelta.y) > 0.5) {
        this.eraseCirclesAt(this.cursorX, this.cursorY);
      }
    }
  }

  /**
   * Create a new circle at the specified position
   */
  private createCircle(x: number, y: number, color: Color): void {
    this.circles.push({
      x,
      y,
      radius: this.currentCircleSize,
      color,
      alpha: 1.0,
      fadeSpeed: 0.005 + Math.random() * 0.01
    });
  }

  /**
   * Add a trail point
   */
  private addTrailPoint(x: number, y: number): void {
    this.trails.push({
      x,
      y,
      alpha: 1.0
    });
  }

  /**
   * Erase circles within the specified radius
   */
  private eraseCirclesAt(x: number, y: number): void {
    this.circles = this.circles.filter(circle => {
      const distance = Math.sqrt(
        (circle.x - x) ** 2 + (circle.y - y) ** 2
      );
      return distance > this.eraseRadius;
    });
  }

  /**
   * Update all circles (fade them over time)
   */
  private updateCircles(): void {
    for (let i = this.circles.length - 1; i >= 0; i--) {
      const circle = this.circles[i];
      circle.alpha -= circle.fadeSpeed;
      
      if (circle.alpha <= 0) {
        this.circles.splice(i, 1);
      }
    }
  }

  /**
   * Update trail points (fade them over time)
   */
  private updateTrails(): void {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      trail.alpha -= 0.02;
      
      if (trail.alpha <= 0) {
        this.trails.splice(i, 1);
      }
    }
  }

  /**
   * Draw all trail points
   */
  private drawTrails(): void {
    for (const trail of this.trails) {
      const trailColor = Color.fromRGBA(255, 255, 255, trail.alpha * 0.5);
      this.canvas.fillCircle(trail.x, trail.y, 2, trailColor);
    }
  }

  /**
   * Draw all circles
   */
  private drawCircles(): void {
    for (const circle of this.circles) {
      const circleColor = Color.fromRGBA(
        circle.color.r,
        circle.color.g,
        circle.color.b,
        circle.alpha
      );
      
      this.canvas.fillCircle(circle.x, circle.y, circle.radius, circleColor);
      
      // Draw border
      const borderColor = Color.fromRGBA(255, 255, 255, circle.alpha * 0.5);
      this.canvas.drawCircle(circle.x, circle.y, circle.radius, borderColor, 1);
    }
  }

  /**
   * Draw cursor and interaction indicators
   */
  private drawCursor(): void {
    // Draw cursor crosshair
    this.canvas.drawLine(
      this.cursorX - 10,
      this.cursorY,
      this.cursorX + 10,
      this.cursorY,
      Color.WHITE,
      1
    );
    this.canvas.drawLine(
      this.cursorX,
      this.cursorY - 10,
      this.cursorX,
      this.cursorY + 10,
      Color.WHITE,
      1
    );

    // Draw current circle size preview
    this.canvas.drawCircle(
      this.cursorX,
      this.cursorY,
      this.currentCircleSize,
      Color.fromRGBA(255, 255, 255, 0.3),
      1
    );

    // Draw erase radius when right clicking
    if (this.input.isButtonDown(MouseButtons.Right)) {
      this.canvas.drawCircle(
        this.cursorX,
        this.cursorY,
        this.eraseRadius,
        Color.fromRGBA(255, 0, 0, 0.5),
        2
      );
    }

    // Draw drag line when dragging
    if (this.isDragging) {
      this.canvas.drawLine(
        this.dragStartX,
        this.dragStartY,
        this.cursorX,
        this.cursorY,
        Color.YELLOW,
        2
      );
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
    this.canvas.drawText("Mouse Input Test", padding, y, Color.WHITE);
    y += lineHeight * 1.5;

    // Instructions
    const instructions = [
      "Controls:",
      "Move Mouse - Control cursor",
      "Left Click - Create red circles",
      "Right Click - Create blue circles",
      "Middle Click - Create green circles",
      "Mouse Wheel - Change circle size",
      "Left Drag - Draw trails",
      "Right Drag - Erase circles",
    ];

    for (const instruction of instructions) {
      this.canvas.drawText(instruction, padding, y, Color.LIGHT_GRAY);
      y += lineHeight;
    }

    // Status info
    y += lineHeight * 0.5;
    const statusInfo = [
      `Position: (${Math.round(this.cursorX)}, ${Math.round(this.cursorY)})`,
      `Circle Size: ${this.currentCircleSize}`,
      `Circles: ${this.circles.length}`,
      `Trails: ${this.trails.length}`,
      `Any button down: ${this.input.isAnyButtonDown() ? "Yes" : "No"}`,
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
      250,
      Color.fromRGBA(0, 0, 0, 0.7)
    );
    this.canvas.drawRect(rightX - 10, y - 5, 290, 250, Color.WHITE, 1);

    this.canvas.drawText("Debug Info", rightX, y, Color.CYAN);
    y += lineHeight * 1.5;

    // Mouse system info
    const debugLines = [
      `Frame: ${debugInfo.frameNumber}`,
      `Input enabled: ${debugInfo.enabled}`,
      `Mouse enabled: ${this.input.isMouseEnabled}`,
      `Position: (${this.input.mouseX}, ${this.input.mouseY})`,
      `Delta: (${this.input.mouseDeltaX}, ${this.input.mouseDeltaY})`,
      `Wheel: (${this.input.mouseWheelX}, ${this.input.mouseWheelY})`,
      `Left: ${this.input.isButtonDown(MouseButtons.Left) ? "Down" : "Up"}`,
      `Right: ${this.input.isButtonDown(MouseButtons.Right) ? "Down" : "Up"}`,
      `Middle: ${this.input.isButtonDown(MouseButtons.Middle) ? "Down" : "Up"}`,
    ];

    for (const line of debugLines) {
      this.canvas.drawText(line, rightX, y, Color.WHITE);
      y += lineHeight;
    }

    // Currently pressed buttons
    const pressedButtons = this.input.getPressedButtons();
    if (pressedButtons.length > 0) {
      this.canvas.drawText("Pressed Buttons:", rightX, y, Color.YELLOW);
      const buttonText = pressedButtons.join(", ");
      this.canvas.drawText(buttonText, rightX + 120, y, Color.LIGHT_GRAY);
      y += lineHeight;
    }

    // Mouse wheel delta
    const wheelDelta = this.input.getMouseWheelDelta();
    if (wheelDelta.x !== 0 || wheelDelta.y !== 0 || wheelDelta.z !== 0) {
      this.canvas.drawText(
        `Wheel Delta: (${wheelDelta.x.toFixed(1)}, ${wheelDelta.y.toFixed(1)}, ${wheelDelta.z.toFixed(1)})`,
        rightX,
        y,
        Color.ORANGE
      );
      y += lineHeight;
    }
  }
}