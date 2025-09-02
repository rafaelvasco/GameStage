// GamepadTestScene.ts - Test scene for gamepad input functionality

import { Scene } from "./Scene";
import { Canvas, Color } from "../graphics";
import { Content } from "../content";
import { GamepadButtons } from "../input";

/**
 * Test scene for demonstrating gamepad input functionality
 * Shows real-time gamepad state and provides interactive feedback
 */
export class GamepadTestScene extends Scene {
  private connectedGamepads: number[] = [];
  private statusLines: string[] = [];
  
  constructor(canvas: Canvas, content: Content) {
    super(canvas, content);
  }

  async initialize(): Promise<boolean> {
    this.canvas.backgroundColor = Color.fromHex("#1a1a1a");
    
    console.log("GamepadTestScene initialized");
    console.log("Instructions:");
    console.log("- Connect up to 4 gamepads");
    console.log("- Press any button or move analog sticks to test");
    console.log("- All input states are displayed in real-time");
    
    return true;
  }

  cleanup(): void {
    // No cleanup needed
  }

  update(_deltaTime: number): void {
    // Update connected gamepads list
    this.connectedGamepads = this.input.getConnectedGamepads();
    
    // Build status information
    this.statusLines = [];
    this.statusLines.push("=== GAMEPAD INPUT TEST ===");
    this.statusLines.push("");
    
    if (this.connectedGamepads.length === 0) {
      this.statusLines.push("No gamepads connected.");
      this.statusLines.push("Please connect a gamepad to test input.");
      return;
    }
    
    // Display info for each connected gamepad
    for (const gamepadIndex of this.connectedGamepads) {
      const info = this.input.getGamepadInfo(gamepadIndex);
      if (!info) continue;
      
      this.statusLines.push(`Gamepad ${gamepadIndex}: ${info.id}`);
      this.statusLines.push(`Mapping: ${info.mapping}`);
      this.statusLines.push("");
      
      // Test face buttons
      const faceButtons = [
        { button: GamepadButtons.A, name: "A" },
        { button: GamepadButtons.B, name: "B" },
        { button: GamepadButtons.X, name: "X" },
        { button: GamepadButtons.Y, name: "Y" }
      ];
      
      let faceButtonsPressed = false;
      for (const { button, name } of faceButtons) {
        if (this.input.isGamepadButtonDown(gamepadIndex, button)) {
          this.statusLines.push(`${name} button: PRESSED`);
          faceButtonsPressed = true;
        } else if (this.input.wasGamepadButtonJustPressed(gamepadIndex, button)) {
          this.statusLines.push(`${name} button: JUST PRESSED`);
          faceButtonsPressed = true;
        } else if (this.input.wasGamepadButtonJustReleased(gamepadIndex, button)) {
          this.statusLines.push(`${name} button: JUST RELEASED`);
          faceButtonsPressed = true;
        }
      }
      if (!faceButtonsPressed) {
        this.statusLines.push("Face buttons: None pressed");
      }
      
      // Test shoulder buttons and triggers
      const shoulderButtons = [
        { button: GamepadButtons.LeftBumper, name: "LB" },
        { button: GamepadButtons.RightBumper, name: "RB" }
      ];
      
      let shoulderPressed = false;
      for (const { button, name } of shoulderButtons) {
        if (this.input.isGamepadButtonDown(gamepadIndex, button)) {
          this.statusLines.push(`${name}: PRESSED`);
          shoulderPressed = true;
        }
      }
      if (!shoulderPressed) {
        this.statusLines.push("Shoulder buttons: None pressed");
      }
      
      // Test triggers (analog)
      const leftTrigger = this.input.getGamepadLeftTrigger(gamepadIndex);
      const rightTrigger = this.input.getGamepadRightTrigger(gamepadIndex);
      if (leftTrigger > 0 || rightTrigger > 0) {
        this.statusLines.push(`LT: ${leftTrigger.toFixed(2)} | RT: ${rightTrigger.toFixed(2)}`);
      } else {
        this.statusLines.push("Triggers: None pressed");
      }
      
      // Test D-Pad
      const dpadButtons = [
        { button: GamepadButtons.DPadUp, name: "Up" },
        { button: GamepadButtons.DPadDown, name: "Down" },
        { button: GamepadButtons.DPadLeft, name: "Left" },
        { button: GamepadButtons.DPadRight, name: "Right" }
      ];
      
      let dpadPressed = false;
      for (const { button, name } of dpadButtons) {
        if (this.input.isGamepadButtonDown(gamepadIndex, button)) {
          this.statusLines.push(`D-Pad ${name}: PRESSED`);
          dpadPressed = true;
        }
      }
      if (!dpadPressed) {
        this.statusLines.push("D-Pad: None pressed");
      }
      
      // Test analog sticks
      const leftStick = this.input.getGamepadLeftStick(gamepadIndex);
      const rightStick = this.input.getGamepadRightStick(gamepadIndex);
      
      if (Math.abs(leftStick.x) > 0.01 || Math.abs(leftStick.y) > 0.01) {
        this.statusLines.push(`Left Stick: (${leftStick.x.toFixed(2)}, ${leftStick.y.toFixed(2)})`);
      } else {
        this.statusLines.push("Left Stick: Centered");
      }
      
      if (Math.abs(rightStick.x) > 0.01 || Math.abs(rightStick.y) > 0.01) {
        this.statusLines.push(`Right Stick: (${rightStick.x.toFixed(2)}, ${rightStick.y.toFixed(2)})`);
      } else {
        this.statusLines.push("Right Stick: Centered");
      }
      
      // Test stick clicks
      const leftStickPressed = this.input.isGamepadButtonDown(gamepadIndex, GamepadButtons.LeftStick);
      const rightStickPressed = this.input.isGamepadButtonDown(gamepadIndex, GamepadButtons.RightStick);
      if (leftStickPressed || rightStickPressed) {
        this.statusLines.push(`Stick clicks: L3=${leftStickPressed} R3=${rightStickPressed}`);
      } else {
        this.statusLines.push("Stick clicks: None");
      }
      
      // Test menu buttons
      const startPressed = this.input.isGamepadButtonDown(gamepadIndex, GamepadButtons.Start);
      const backPressed = this.input.isGamepadButtonDown(gamepadIndex, GamepadButtons.Back);
      const homePressed = this.input.isGamepadButtonDown(gamepadIndex, GamepadButtons.Home);
      if (startPressed || backPressed || homePressed) {
        this.statusLines.push(`Menu: Start=${startPressed} Back=${backPressed} Home=${homePressed}`);
      } else {
        this.statusLines.push("Menu buttons: None");
      }
      
      this.statusLines.push("");
    }
    
    // Add performance information
    if (this.input.isGamepadEnabled && this.connectedGamepads.length > 0) {
      const debugInfo = this.input.getDebugInfo();
      if (debugInfo.gamepad) {
        this.statusLines.push(`Performance: ${debugInfo.gamepad.pollRate.toFixed(1)} FPS`);
        this.statusLines.push(`Deadzone: ${debugInfo.gamepad.deadzone.toFixed(2)}`);
        this.statusLines.push(`Trigger Deadzone: ${debugInfo.gamepad.triggerDeadzone.toFixed(2)}`);
      }
    }
  }

  fixedUpdate(_fixedTimeStep: number): void {
    // No fixed updates needed for this test scene
  }

  draw(_interpolationFactor: number): void {
    // Get canvas dimensions
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Set text properties
    const lineHeight = 18;
    const margin = 20;
    
    // Draw title
    this.canvas.drawText(
      "GAMEPAD INPUT TEST",
      width / 2 - 100,
      margin,
      Color.WHITE
    );
    
    // Draw status lines
    let y = margin + lineHeight * 2;
    for (const line of this.statusLines) {
      if (line === "") {
        y += lineHeight / 2;
        continue;
      }
      
      let color = Color.WHITE;
      
      // Color coding for different states
      if (line.includes("PRESSED") && !line.includes("JUST")) {
        color = Color.GREEN;
      } else if (line.includes("JUST PRESSED")) {
        color = Color.GREEN; // Use GREEN instead of LIME
      } else if (line.includes("JUST RELEASED")) {
        color = Color.ORANGE;
      } else if (line.includes("Gamepad") && line.includes(":")) {
        color = Color.CYAN;
      } else if (line.includes("Mapping:")) {
        color = Color.GRAY;
      }
      
      this.canvas.drawText(line, margin, y, color);
      y += lineHeight;
      
      // Prevent overflow
      if (y > height - margin) {
        break;
      }
    }
    
    // Draw instructions at bottom
    const instructionY = height - 80;
    this.canvas.drawText("Instructions:", margin, instructionY, Color.YELLOW);
    this.canvas.drawText("• Connect a gamepad and press any button", margin, instructionY + lineHeight, Color.WHITE);
    this.canvas.drawText("• Move analog sticks to see real-time values", margin, instructionY + lineHeight * 2, Color.WHITE);
    this.canvas.drawText("• All button states update in real-time", margin, instructionY + lineHeight * 3, Color.WHITE);
  }
}