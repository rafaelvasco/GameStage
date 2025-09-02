import { Scene } from "./Scene";
import { Canvas } from "../graphics/Canvas";
import { Content } from "../content/Content";
import { Color } from "../graphics/Color";

export class EmptyScene extends Scene {
  constructor(canvas: Canvas, content: Content) {
    super(canvas, content);
  }

  async initialize(): Promise<boolean> {
    return true;
  }

  update(_deltaTime: number): void {
    // Empty scene does nothing
  }

  fixedUpdate(_fixedTimeStep: number): void {
    // Empty scene does nothing
  }

  draw(_interpolationFactor: number): void {
    // Clear to black
    this.canvas.fillRect(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      Color.BLACK
    );
    
    // Draw simple message
    const message = "Empty Scene - Game is running";
    const textMeasure = this.canvas.measureText(message);
    this.canvas.drawText(
      message,
      (this.canvas.width - textMeasure.width) / 2,
      this.canvas.height / 2,
      Color.WHITE
    );
  }

  cleanup(): void {
    // Nothing to clean up
  }
}