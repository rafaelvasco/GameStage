// FontTestScene.ts - Test scene demonstrating font loading through the Content system with different rendering options

import { Scene } from "./Scene";
import { Canvas, Color } from "../graphics";
import { Content, Font } from "../content";

export class FontTestScene extends Scene {
  private snesFont: Font = null!;

  constructor(canvas: Canvas, content: Content) {
    super(canvas, content);
  }

  async initialize(): Promise<boolean> {
    this.canvas.backgroundColor = Color.fromHex("#2c3e50");

    try {
      // Load the fonts bundle first
      const loaded = await this.content.loadBundle("fonts-test");
      if (!loaded) {
        console.error("Failed to load fonts bundle");
        return false;
      }

      this.snesFont = this.content.getFont("snes-font");

      return true;
    } catch (error) {
      console.error("Failed to initialize Content font test scene:", error);
      return false;
    }
  }

  cleanup(): void {}

  update(_deltaTime: number): void {
    // No updates needed for static text demo
  }

  fixedUpdate(_fixedTimeStep: number): void {
    // No fixed updates needed for static text demo
  }

  async draw(_interpolationFactor: number): Promise<void> {
    // Custom Fonts

    const text = `Custom Font`;

    this.canvas.setFont(this.snesFont);

    this.canvas.drawText(text, 200, 0);

    // Default Font

    this.canvas.setFont(null);

    // Test basic text drawing with default font (already set by Canvas initialization)
    this.canvas.drawText("Default Font Test", 50, 50, Color.WHITE);

    // Test different colors
    this.canvas.drawText("Red Text", 50, 70, Color.RED);
    this.canvas.drawText("Green Text", 50, 90, Color.GREEN);
    this.canvas.drawText("Blue Text", 50, 110, Color.BLUE);

    // Test text alignment and scaling
    this.canvas.drawTextEx("Left Aligned", 50, 140, Color.YELLOW, "left");
    this.canvas.drawTextEx("Center Aligned", 400, 160, Color.CYAN, "center");
    this.canvas.drawTextEx("Right Aligned", 750, 180, Color.MAGENTA, "right");

    // Test all ASCII characters
    let yPos = 320;
    const charsPerLine = 32;
    for (let i = 32; i <= 126; i += charsPerLine) {
      let line = "";
      for (let j = 0; j < charsPerLine && i + j <= 126; j++) {
        line += String.fromCharCode(i + j);
      }
      this.canvas.drawText(line, 50, yPos, Color.WHITE);
      yPos += 20;
    }

    // Test text measurement
    const testMeasureText = "Measured Text";
    const measurements = this.canvas.measureText(testMeasureText);
    this.canvas.drawText(testMeasureText, 400, 360, Color.WHITE);
    this.canvas.drawRect(
      400,
      360,
      measurements.width,
      measurements.height,
      Color.GREEN,
      1
    );

    // Test text area
    const areaText =
      "This is a longer text that should wrap within the specified area. It demonstrates the text area functionality with word wrapping.";
    this.canvas.drawTextArea(areaText, 50, 420, 300, 80, Color.LIGHT_GRAY, {
      align: "justify",
      verticalAlign: "top",
      padding: 5,
      clipToArea: true,
    });

    // Draw border around text area for visualization
    this.canvas.drawRect(50, 420, 300, 80, Color.WHITE, 1);
  }
}
