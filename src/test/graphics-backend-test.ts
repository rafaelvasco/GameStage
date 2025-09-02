import { Canvas } from "../graphics/Canvas";
import { Logger } from "../utils/Logger";
import { Color } from "../graphics/Color";
import { GraphicsBackendType } from "../graphics/Graphics";

/**
 * Check if WebGL2 is supported in the current environment
 */
function checkWebGL2Support(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    return gl !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Clean up any existing test canvases and app containers
 */
function cleanupTestEnvironment(): void {
  // Remove any existing app-canvas elements
  const existingCanvases = document.querySelectorAll("#app-canvas");
  existingCanvases.forEach((canvas) => canvas.remove());

  // Remove any existing app containers from previous tests
  const existingContainers = document.querySelectorAll("#app");
  existingContainers.forEach((container) => container.remove());
}

export async function testGraphicsBackend(
  preferredBackend: GraphicsBackendType = GraphicsBackendType.Auto
): Promise<void> {
  const logger = Logger.getInstance();

  logger.info(
    `=== Graphics Backend Test (${preferredBackend.toUpperCase()}) ===`,
    Color.fromHex("#00FFFF")
  );

  // Reset graphics instances to ensure clean state
  const { Graphics } = await import("../graphics/Graphics");
  Graphics.resetInstance();

  // Clean up any existing test elements
  cleanupTestEnvironment();

  // Check WebGL2 support if WebGL2 backend is requested or auto
  if (
    preferredBackend === GraphicsBackendType.WebGL2 ||
    preferredBackend === GraphicsBackendType.Auto
  ) {
    const webgl2Supported = checkWebGL2Support();
    logger.info(
      `WebGL2 Support Check: ${
        webgl2Supported ? "✅ Supported" : "❌ Not Supported"
      }`,
      webgl2Supported ? Color.fromHex("#44FF44") : Color.fromHex("#FF4444")
    );

    if (!webgl2Supported && preferredBackend === GraphicsBackendType.WebGL2) {
      const errorMessage =
        "WebGL2 backend requested but WebGL2 is not supported in this environment";
      logger.error(errorMessage, Color.fromHex("#FF4444"));
      throw new Error(errorMessage);
    }
  }

  // Create a test app container
  const appContainer = document.createElement("div");
  appContainer.id = "app";
  appContainer.style.display = "none"; // Hide the test container
  document.body.appendChild(appContainer);

  // Create Canvas instance with specified backend preference
  const gameCanvas = new Canvas(800, 600, preferredBackend);

  logger.info(
    `Attempting to initialize graphics backend (preference: ${preferredBackend})...`,
    Color.fromHex("#00AAFF")
  );

  const initialized = await gameCanvas.initialize();

  if (!initialized) {
    const errorMessage = "Graphics backend initialization failed!";
    logger.error(errorMessage, Color.fromHex("#FF4444"));
    throw new Error(errorMessage);
  }

  logger.success(
    "Graphics backend initialization successful!",
    Color.fromHex("#44FF44")
  );

  // Log detailed backend information
  gameCanvas.logBackendInfo();

  // Test basic backend functionality
  logger.group("Backend Functionality Test", Color.fromHex("#FFAA00"));

  logger.info(
    `Requested Backend: ${gameCanvas.requestedBackendType}`,
    Color.fromHex("#00AAFF")
  );
  logger.info(
    `Actual Backend: ${gameCanvas.backendType}`,
    Color.fromHex("#00AAFF")
  );
  logger.info(
    `Canvas Dimensions: ${gameCanvas.width}x${gameCanvas.height}`,
    Color.fromHex("#00AAFF")
  );

  // Test a basic frame cycle
  try {
    gameCanvas.beginFrame();
    logger.debug("Frame started successfully", Color.fromHex("#888888"));

    gameCanvas.endFrame();
    logger.debug("Frame ended successfully", Color.fromHex("#888888"));

    logger.success(
      "Basic rendering cycle test passed",
      Color.fromHex("#44FF44")
    );
  } catch (error) {
    const errorMessage = `Frame cycle test failed: ${error}`;
    logger.error(errorMessage, Color.fromHex("#FF4444"));
    throw new Error(errorMessage);
  }

  logger.groupEnd();

  logger.info(
    `=== Graphics Backend Test Complete (${preferredBackend.toUpperCase()}) ===`,
    Color.fromHex("#00FFFF")
  );
}

/**
 * Test all available backend options
 */
export async function testAllGraphicsBackends(): Promise<void> {
  const logger = Logger.getInstance();

  logger.info(
    "=== Testing All Graphics Backend Options ===",
    Color.fromHex("#FFFF00")
  );

  // Test auto selection
  await testGraphicsBackend(GraphicsBackendType.Auto);

  // Reset graphics instance between tests
  const { Graphics } = await import("../graphics/Graphics");
  Graphics.resetInstance();

  // Test forced WebGL2
  await testGraphicsBackend(GraphicsBackendType.WebGL2);

  // Reset graphics instance between tests
  Graphics.resetInstance();

  // Test forced WebGPU (will fallback if not supported)
  await testGraphicsBackend(GraphicsBackendType.WebGPU);

  logger.info(
    "=== All Graphics Backend Tests Complete ===",
    Color.fromHex("#FFFF00")
  );
}
