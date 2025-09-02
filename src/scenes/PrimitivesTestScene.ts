import { Scene } from "./Scene";
import { Canvas } from "../graphics/Canvas";
import { Content } from "../content/Content";
import { Color } from "../graphics/Color";
import { logger } from "../utils";

export class PrimitivesTestScene extends Scene {
  // Animation state
  private time: number = 0;
  private animationSpeed: number = 0.002;

  constructor(canvas: Canvas, content: Content) {
    super(canvas, content);
  }

  async initialize(): Promise<boolean> {
    logger.info("Initializing PrimitivesTestScene...");

    // Test if canvas is properly initialized
    if (!this.canvas) {
      logger.error("Canvas is null in PrimitivesTestScene");
      return false;
    }

    // Test basic canvas functionality
    logger.info(
      `Canvas dimensions: ${this.canvas.width}x${this.canvas.height}`
    );
    logger.info(`Canvas backend: ${this.canvas.backendType}`);

    // No assets needed for primitive testing
    logger.success("PrimitivesTestScene initialized successfully");
    return true;
  }

  update(deltaTime: number): void {
    this.time += deltaTime;
  }

  fixedUpdate(_fixedTimeStep: number): void {
    // No fixed updates needed for this test
  }

  draw(_interpolationFactor: number): void {
    this.drawPrimitiveTests();
  }

  private drawPrimitiveTests(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const margin = 50;
    //const gridSize = 150;

    // Animated values for dynamic effects
    const pulse = Math.sin(this.time * this.animationSpeed) * 0.5 + 0.5; // 0-1
    const rotation = this.time * this.animationSpeed * 0.5;

    // Test 1: Rectangle outlines (top-left)
    const rectX = margin;
    const rectY = margin;
    this.canvas.drawRect(rectX, rectY, 200, 120, Color.RED, 2);
    this.canvas.drawRect(rectX + 10, rectY + 10, 160, 80, Color.GREEN, 1);
    this.canvas.drawRect(rectX + 20, rectY + 20, 120, 40, Color.BLUE, 3);

    // Test 2: Filled rectangles (top-center)
    const fillRectX = centerX - 50;
    const fillRectY = margin;
    this.canvas.fillRect(
      fillRectX,
      fillRectY,
      200,
      120,
      Color.fromHex("#FFFF00")
    ); // Yellow
    this.canvas.fillRect(
      fillRectX + 15,
      fillRectY + 15,
      140,
      60,
      Color.fromHex("#FF00FF")
    ); // Magenta
    this.canvas.fillRect(
      fillRectX + 30,
      fillRectY + 30,
      160,
      60,
      Color.fromHex("#00FFFF")
    ); // Cyan

    // Test 3: Circle outlines (top-right)
    const circleX = this.canvas.width - margin - 100;
    const circleY = margin + 50;
    this.canvas.drawCircle(circleX, circleY, 80, Color.RED, 1);
    this.canvas.drawCircle(circleX, circleY, 50, Color.GREEN, 2);
    this.canvas.drawCircle(circleX, circleY, 20, Color.BLUE, 4);

    // Test 4: Filled circles (center-left)
    const fillCircleX = margin + 75;
    const fillCircleY = centerY;
    this.canvas.fillCircle(fillCircleX, fillCircleY, 80, Color.RED.withA(0.7));
    this.canvas.fillCircle(
      fillCircleX + 20,
      fillCircleY,
      60,
      Color.GREEN.withA(0.7)
    );
    this.canvas.fillCircle(
      fillCircleX + 10,
      fillCircleY + 20,
      50,
      Color.BLUE.withA(0.7)
    );

    // Test 5: Animated pulsing circle (center)
    const pulseRadius = 60 + pulse * 40;
    const pulseColor = Color.fromRGBA(pulse, 1 - pulse, 0.5, 0.8);
    this.canvas.fillCircle(centerX, centerY, pulseRadius, pulseColor);
    this.canvas.drawCircle(centerX, centerY, pulseRadius + 5, Color.WHITE, 4);

    // Test 6: Ovals (center-right)
    const ovalX = this.canvas.width - margin - 75;
    const ovalY = centerY;
    this.canvas.drawOval(ovalX, ovalY, 80, 60, Color.fromHex("#FF8000"), 2); // Orange
    this.canvas.fillOval(ovalX, ovalY, 70, 40, Color.ORANGE.withA(0.6));

    // Test 7: Triangles (bottom-left)
    const triX = margin + 75;
    const triY = this.canvas.height - margin - 50;

    // Triangle outline
    this.canvas.drawTriangle(
      triX - 80,
      triY + 60, // bottom-left
      triX + 80,
      triY + 60, // bottom-right
      triX,
      triY - 60, // top
      Color.fromHex("#800080"), // Purple
      2
    );

    // Filled triangle (smaller, inside)
    this.canvas.fillTriangle(
      triX - 40,
      triY + 30, // bottom-left
      triX + 40,
      triY + 30, // bottom-right
      triX,
      triY - 30, // top
      Color.PURPLE.withA(0.7)
    );

    // Equilateral triangle outline
    this.canvas.drawEquilateralTriangle(
      triX,
      triY,
      80,
      Color.fromHex("#800080"),
      4
    );

    // // Equilateral triangles
    // const eqTriX = this.canvas.width - margin - 150;
    // const eqTriY = centerY - 100;

    // // Equilateral triangle outline (center-based)
    // this.canvas.drawEquilateralTriangle(
    //   eqTriX,
    //   eqTriY,
    //   80, // side length
    //   Color.fromHex("#FF6600"), // Orange
    //   3, // line width
    //   rotation // animated rotation
    // );

    // // Filled equilateral triangle (smaller, rotating opposite direction)
    // this.canvas.fillEquilateralTriangle(
    //   eqTriX,
    //   eqTriY,
    //   50, // side length
    //   Color.fromRGBA(1, 0.4, 0, 0.6), // Semi-transparent orange
    //   -rotation * 1.5 // rotating opposite direction, faster
    // );

    // // Equilateral triangles from base (bottom area)
    // const baseTriX = eqTriX;
    // const baseTriY = centerY + 100;

    // // Pointing up (outline)
    // this.canvas.drawEquilateralTriangleFromBase(
    //   baseTriX - 40,
    //   baseTriY,
    //   60,
    //   Color.fromHex("#00AA88"), // Teal
    //   2,
    //   true
    // );

    // // Pointing up (filled, smaller)
    // this.canvas.fillEquilateralTriangleFromBase(
    //   baseTriX - 40,
    //   baseTriY,
    //   40,
    //   Color.fromRGBA(0, 0.7, 0.5, 0.7),
    //   true
    // );

    // // Pointing down (outline)
    // this.canvas.drawEquilateralTriangleFromBase(
    //   baseTriX + 40,
    //   baseTriY,
    //   60,
    //   Color.fromHex("#AA0088"), // Magenta
    //   2,
    //   false
    // );

    // // Pointing down (filled, smaller)
    // this.canvas.fillEquilateralTriangleFromBase(
    //   baseTriX + 40,
    //   baseTriY,
    //   40,
    //   Color.fromRGBA(0.7, 0, 0.5, 0.7),
    //   false
    // );

    // // Animated equilateral triangle pattern (top-right corner)
    // const patternX = this.canvas.width - margin - 80;
    // const patternY = margin + 80;
    // const animatedScale = 0.7 + pulse * 0.3; // Scale animation

    // for (let i = 0; i < 3; i++) {
    //   const angle = (i * Math.PI * 2) / 3 + rotation;
    //   const offsetX = Math.cos(angle) * 30;
    //   const offsetY = Math.sin(angle) * 30;

    //   this.canvas.fillEquilateralTriangle(
    //     patternX + offsetX,
    //     patternY + offsetY,
    //     30 * animatedScale,
    //     Color.fromHSV(i * 120, 0.8, 1), // Different hue for each triangle
    //     angle
    //   );
    // }

    // Test 11: Lines (bottom-center)
    const lineStartX = centerX - 60;
    const lineStartY = this.canvas.height - margin - 50;
    const lineEndX = centerX + 60;

    // Horizontal lines with different widths
    this.canvas.drawLine(
      lineStartX,
      lineStartY - 20,
      lineEndX,
      lineStartY - 20,
      Color.RED,
      1
    );
    this.canvas.drawLine(
      lineStartX,
      lineStartY,
      lineEndX,
      lineStartY,
      Color.GREEN,
      3
    );
    this.canvas.drawLine(
      lineStartX,
      lineStartY + 20,
      lineEndX,
      lineStartY + 20,
      Color.BLUE,
      5
    );

    // Animated rotating line
    const lineLength = 50;
    const lineCenterX = centerX;
    const lineCenterY = this.canvas.height - margin - 50;
    const x1 = lineCenterX + Math.cos(rotation) * lineLength;
    const y1 = lineCenterY + Math.sin(rotation) * lineLength;
    const x2 = lineCenterX - Math.cos(rotation) * lineLength;
    const y2 = lineCenterY - Math.sin(rotation) * lineLength;
    this.canvas.drawLine(x1, y1, x2, y2, Color.YELLOW, 2); // Yellow

    // Test 12: Points (bottom-right)
    const pointStartX = this.canvas.width - margin - 100;
    const pointStartY = this.canvas.height - margin - 50;

    // Grid of points with different colors
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 5; j++) {
        const px = pointStartX + i * 10;
        const py = pointStartY + j * 10 - 20;
        const hue = (i + j) / 15;
        const pointColor = Color.fromHSV(hue * 360, 1, 1);
        this.canvas.drawPoint(px, py, pointColor);
      }
    }

    // // Test 10: Complex shape using transform stack
    // this.canvas.pushTransform();
    // this.canvas.translate(centerX, centerY - 100);
    // this.canvas.rotate(rotation);

    // // Draw a flower-like pattern
    // for (let i = 0; i < 8; i++) {
    //   this.canvas.pushTransform();
    //   this.canvas.rotate((i / 8) * Math.PI * 2);
    //   this.canvas.fillOval(0, -20, 8, 20, Color.fromHSV(i * 45, 0.8, 1));
    //   this.canvas.popTransform();
    // }

    // // Center circle
    // this.canvas.fillCircle(0, 0, 8, Color.WHITE);
    // this.canvas.popTransform();

    // // Test labels (simple text using rectangles as placeholders)
    // this.drawLabel("Rect Outline", margin + 50, margin - 10);
    // this.drawLabel("Filled Rect", centerX, margin - 10);
    // this.drawLabel("Circle Outline", circleX, margin - 10);
    // this.drawLabel("Filled Circle", fillCircleX, centerY - 70);
    // this.drawLabel("Pulsing", centerX, centerY - 70);
    // this.drawLabel("Ovals", ovalX, centerY - 70);
    // this.drawLabel("Triangles", triX, triY + 70);
    // this.drawLabel("Lines", centerX, lineStartY + 50);
    // this.drawLabel("Points", pointStartX + 50, pointStartY + 40);
    // this.drawLabel("Transform", centerX, centerY - 150);
  }

  //   private drawLabel(text: string, x: number, y: number): void {
  //     // Simple label using a small rectangle as placeholder
  //     // In a real implementation, this would render actual text
  //     const width = text.length * 6;
  //     const height = 12;
  //     this.canvas.fillRect(
  //       x - width / 2,
  //       y - height / 2,
  //       width,
  //       height,
  //       Color.fromRGBA(0, 0, 0, 0.7)
  //     );
  //     this.canvas.drawRect(
  //       x - width / 2,
  //       y - height / 2,
  //       width,
  //       height,
  //       Color.WHITE,
  //       1
  //     );
  //   }

  cleanup(): void {
    logger.info("Cleaning up PrimitivesTestScene...");
    // No cleanup needed for primitive tests
  }
}
