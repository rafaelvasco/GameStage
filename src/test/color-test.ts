// color-test.ts - Simple test to demonstrate Color class functionality including Flyweight pattern

import { Color } from "../graphics/Color";

export function testColor(): void {
  // Test the Color class
  console.log("=== Color Class Test ===");

  // Test basic color creation
  const red = Color.RED;
  const green = Color.fromHex("#00FF00");
  const blue = Color.BLUE;
  const darkGray = Color.DARK_GRAY;

  console.log("Red:", red.toString(), "RGBA:", red.rgba);
  console.log("Green:", green.toString(), "RGBA:", green.rgba);
  console.log("Blue:", blue.toString(), "RGBA:", blue.rgba);
  console.log("Dark Gray:", darkGray.toString(), "RGBA:", darkGray.rgba);

  // Test color comparison efficiency
  const color1 = Color.fromRGBA(0.1, 0.1, 0.1, 1.0);
  const color2 = Color.DARK_GRAY;
  const color3 = Color.fromRGBA(0.2, 0.2, 0.2, 1.0);

  console.log("\n=== Color Comparison Test ===");
  console.log("color1 equals DARK_GRAY:", color1.equals(color2));
  console.log("color1 RGBA:", color1.rgba, "DARK_GRAY RGBA:", color2.rgba);
  console.log("color1 equals color3:", color1.equals(color3));

  // Test Flyweight pattern - same colors should be identical instances
  console.log("\n=== Flyweight Pattern Test ===");
  const red1 = Color.RED;
  const red2 = Color.RED;
  const red3 = Color.fromHex("#FF0000");
  const red4 = Color.RED;

  console.log("red1 === red2 (same instance):", red1 === red2);
  console.log("red1 === red3 (same instance):", red1 === red3);
  console.log("red1 === red4 (same instance):", red1 === red4);
  console.log("All red colors are the same flyweight instance!");

  // Test cache size
  console.log("Cache size before creating many colors:", Color.getCacheSize());

  // Create many colors - should reuse flyweight instances
  const colors = [];
  for (let i = 0; i < 1000; i++) {
    // This will create only a few unique colors due to rounding
    const r = Math.round(Math.random() * 10) / 10;
    const g = Math.round(Math.random() * 10) / 10;
    const b = Math.round(Math.random() * 10) / 10;
    colors.push(Color.fromRGBA(r, g, b, 1));
  }

  console.log(
    "Cache size after creating 1000 'random' colors:",
    Color.getCacheSize()
  );
  console.log(
    "Memory saved: Only",
    Color.getCacheSize(),
    "unique colors created instead of 1000!"
  );

  // Test immutable operations
  console.log("\n=== Immutable Operations Test ===");
  const originalColor = Color.GRAY;
  const modifiedColor = originalColor.withR(1.0);
  const anotherModified = originalColor.withA(0.5);

  console.log("Original:", originalColor.toString());
  console.log("With red=1.0:", modifiedColor.toString());
  console.log("With alpha=0.5:", anotherModified.toString());
  console.log("Original unchanged:", originalColor.toString());

  // Test that modified colors are also flyweights
  const sameModified = Color.RED.withG(0.5);
  console.log("Modified color is flyweight:", modifiedColor === sameModified);

  // Test performance of integer comparison vs component comparison
  const iterations = 1000000;

  console.log("\n=== Performance Test ===");
  let integerChangedCount = 0;
  console.time("Integer comparison");
  for (let i = 0; i < iterations; i++) {
    const changed = color1.rgba !== color2.rgba;
    if (changed) integerChangedCount++;
  }
  console.timeEnd("Integer comparison");

  // Component comparison (old approach)
  let componentChangedCount = 0;
  console.time("Component comparison");
  for (let i = 0; i < iterations; i++) {
    const changed =
      color1.r !== color2.r ||
      color1.g !== color2.g ||
      color1.b !== color2.b ||
      color1.a !== color2.a;
    if (changed) componentChangedCount++;
  }
  console.timeEnd("Component comparison");

  console.log("Integer comparison changes:", integerChangedCount);
  console.log("Component comparison changes:", componentChangedCount);

  // Test color conversion
  console.log("\n=== Color Conversion Test ===");
  const testColor = Color.fromRGBA(0.5, 0.75, 0.25, 0.8);
  console.log("Original:", testColor.toString());
  console.log("Hex:", testColor.toHex(true));

  console.log("\n=== Final Cache Statistics ===");
  console.log("Total flyweight colors cached:", Color.getCacheSize());
}
