// Matrix test - Basic verification that the centralized Matrix utility works correctly

import { Matrix } from "../utils/Matrix";

/**
 * Test the Matrix utility class to ensure all operations work correctly
 */
export function testMatrix(): void {
  console.log("🧮 Testing Matrix utility class...");

  // Test identity matrix creation
  const identity = Matrix.createIdentity();
  const expectedIdentity = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);

  if (!Matrix.equals(identity, expectedIdentity)) {
    console.error("❌ Identity matrix creation failed");
    throw new Error("Identity matrix creation failed");
  }
  console.log("✅ Identity matrix creation: PASSED");

  // Test translation matrix
  const translation = Matrix.createTranslation(10, 20);
  const point = Matrix.transformPoint(translation, 5, 5);

  if (Math.abs(point.x - 15) > 0.001 || Math.abs(point.y - 25) > 0.001) {
    console.error("❌ Translation matrix failed");
    console.error(`Expected: (15, 25), Got: (${point.x}, ${point.y})`);
    throw new Error("Translation matrix failed");
  }
  console.log("✅ Translation matrix: PASSED");

  // Test scale matrix
  const scale = Matrix.createScale(2, 3);
  const scaledPoint = Matrix.transformPoint(scale, 4, 5);

  if (
    Math.abs(scaledPoint.x - 8) > 0.001 ||
    Math.abs(scaledPoint.y - 15) > 0.001
  ) {
    console.error("❌ Scale matrix failed");
    console.error(
      `Expected: (8, 15), Got: (${scaledPoint.x}, ${scaledPoint.y})`
    );
    throw new Error("Scale matrix failed");
  }
  console.log("✅ Scale matrix: PASSED");

  // Test rotation matrix (45 degrees)
  const rotation = Matrix.createRotationZ(Math.PI / 4);
  const rotatedPoint = Matrix.transformPoint(rotation, 1, 0);
  const expected = Math.sqrt(2) / 2;

  if (
    Math.abs(rotatedPoint.x - expected) > 0.001 ||
    Math.abs(rotatedPoint.y - expected) > 0.001
  ) {
    console.error("❌ Rotation matrix failed");
    console.error(
      `Expected: (${expected}, ${expected}), Got: (${rotatedPoint.x}, ${rotatedPoint.y})`
    );
    throw new Error("Rotation matrix failed");
  }
  console.log("✅ Rotation matrix: PASSED");

  // Test matrix multiplication
  const translationMatrix = Matrix.createTranslation(5, 10);
  const scaleMatrix = Matrix.createScale(2, 2);

  // To get "scale first, then translate", we need: scale * translation
  // Matrix multiplication is right-to-left: result = scale * translation means apply translation first, then scale
  // But we want scale first, then translate, so we need: translate * scale
  // Wait, that's backwards! Let me re-read the math...

  // Actually, for "apply scale first, then translate" we need: translate * scale
  // This is because in matrix multiplication A * B, B is applied first, then A
  // So translate * scale means: apply scale first, then apply translate
  const result = Matrix.multiply(translationMatrix, scaleMatrix);

  console.log("🔍 Matrix multiplication debug:");
  console.log("Translation matrix:", Matrix.toString(translationMatrix, 3));
  console.log("Scale matrix:", Matrix.toString(scaleMatrix, 3));
  console.log("Result matrix:", Matrix.toString(result, 3));

  // Apply combined transformation
  const finalPoint = Matrix.transformPoint(result, 3, 4);
  console.log(
    `Transform (3, 4) with combined matrix: (${finalPoint.x}, ${finalPoint.y})`
  );

  // Test individual transformations to understand the expected behavior
  const scaledFirst = Matrix.transformPoint(scaleMatrix, 3, 4); // Scale first: (6, 8)
  const thenTranslated = Matrix.transformPoint(
    translationMatrix,
    scaledFirst.x,
    scaledFirst.y
  ); // Then translate: (11, 18)
  console.log(`Scale first (3, 4) -> (${scaledFirst.x}, ${scaledFirst.y})`);
  console.log(
    `Then translate (${scaledFirst.x}, ${scaledFirst.y}) -> (${thenTranslated.x}, ${thenTranslated.y})`
  );

  // The issue was with matrix multiplication order understanding
  // For "scale first, then translate", we actually need Matrix.multiply(scaleMatrix, translationMatrix)
  // Let's test the correct order
  const correctResult = Matrix.multiply(scaleMatrix, translationMatrix);
  const correctFinalPoint = Matrix.transformPoint(correctResult, 3, 4);
  console.log(
    `Correct order (scale * translation): (${correctFinalPoint.x}, ${correctFinalPoint.y})`
  );

  // Expected: (3*2=6, 4*2=8) then (6+5=11, 8+10=18) = (11, 18)
  if (
    Math.abs(correctFinalPoint.x - 11) > 0.001 ||
    Math.abs(correctFinalPoint.y - 18) > 0.001
  ) {
    console.error("❌ Matrix multiplication failed");
    console.error(
      `Expected: (11, 18), Got: (${correctFinalPoint.x}, ${correctFinalPoint.y})`
    );
    throw new Error("Matrix multiplication failed");
  }
  console.log("✅ Matrix multiplication: PASSED");

  // Test orthographic projection matrix
  const ortho = Matrix.createOrthographic(0, 800, 600, 0, -1, 1);

  // Transform a point from screen coordinates to normalized device coordinates
  const screenPoint = Matrix.transformPoint(ortho, 400, 300); // Center of 800x600 screen

  // Should be approximately (0, 0) in NDC space
  if (Math.abs(screenPoint.x) > 0.001 || Math.abs(screenPoint.y) > 0.001) {
    console.error("❌ Orthographic projection matrix failed");
    console.error(
      `Expected: (0, 0), Got: (${screenPoint.x}, ${screenPoint.y})`
    );
    throw new Error("Orthographic projection matrix failed");
  }
  console.log("✅ Orthographic projection matrix: PASSED");

  // Test matrix copy and clone
  const original = Matrix.createTranslation(1, 2, 3);
  const cloned = Matrix.clone(original);
  const copied = new Float32Array(16);
  Matrix.copy(original, copied);

  if (!Matrix.equals(original, cloned) || !Matrix.equals(original, copied)) {
    console.error("❌ Matrix copy/clone failed");
    throw new Error("Matrix copy/clone failed");
  }
  console.log("✅ Matrix copy/clone: PASSED");

  console.log("🎉 All Matrix utility tests PASSED!");
}
