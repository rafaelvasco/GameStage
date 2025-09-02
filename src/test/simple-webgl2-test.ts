// Simple WebGL2 test to isolate the issue

import { Logger } from "../utils/Logger";
import { Color } from "../graphics/Color";

export async function simpleWebGL2Test(): Promise<void> {
  const logger = Logger.getInstance();

  logger.info("🧪 Simple WebGL2 Test", Color.fromHex("#FFD700"));

  try {
    // Create a canvas
    logger.info("Creating canvas element...", Color.fromHex("#00AAFF"));
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    canvas.id = "test-canvas";

    // Add to DOM
    document.body.appendChild(canvas);

    // Try to get WebGL2 context
    logger.info("Getting WebGL2 context...", Color.fromHex("#00AAFF"));
    const gl = canvas.getContext("webgl2");

    if (!gl) {
      throw new Error("WebGL2 context is null");
    }

    logger.success(
      "WebGL2 context created successfully",
      Color.fromHex("#44FF44")
    );

    // Log basic info
    logger.info(
      `Renderer: ${gl.getParameter(gl.RENDERER)}`,
      Color.fromHex("#888888")
    );
    logger.info(
      `Vendor: ${gl.getParameter(gl.VENDOR)}`,
      Color.fromHex("#888888")
    );
    logger.info(
      `Version: ${gl.getParameter(gl.VERSION)}`,
      Color.fromHex("#888888")
    );

    // Try basic operations
    logger.info("Testing basic WebGL2 operations...", Color.fromHex("#00AAFF"));

    // Clear color
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Create a buffer
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error("Failed to create buffer");
    }
    logger.success("Buffer created successfully", Color.fromHex("#44FF44"));

    // Create a texture
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("Failed to create texture");
    }
    logger.success("Texture created successfully", Color.fromHex("#44FF44"));

    // Create a VAO
    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error("Failed to create VAO");
    }
    logger.success("VAO created successfully", Color.fromHex("#44FF44"));

    // Clean up
    gl.deleteBuffer(buffer);
    gl.deleteTexture(texture);
    gl.deleteVertexArray(vao);
    document.body.removeChild(canvas);

    logger.success("🎉 Simple WebGL2 test passed!", Color.fromHex("#44FF44"));
  } catch (error) {
    logger.error(
      `Simple WebGL2 test failed: ${error}`,
      Color.fromHex("#FF4444")
    );
    throw error;
  }
}
