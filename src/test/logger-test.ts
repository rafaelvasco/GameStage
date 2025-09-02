import { logger, LogLevel, LogColors, Logger } from "../utils/index";
import { Color } from "../graphics/Color";

export function testLogger(): void {
  console.log("=== Logger Test ===");

  // Test basic logging methods
  logger.debug("This is a debug message");
  logger.info("This is an info message");
  logger.warn("This is a warning message");
  logger.error("This is an error message");
  logger.success("This is a success message");

  // Test custom colors
  logger.paint("Custom purple message", LogColors.PURPLE);
  logger.paint("Custom cyan message", LogColors.CYAN);
  logger.paint("Custom pink message", LogColors.PINK);

  // Test with custom Color objects
  const customColor = Color.fromHex("#FF6B35");
  logger.paint("Message with custom orange color", customColor);

  // Test grouping
  logger.group("Graphics System", LogColors.CYAN);
  logger.info("WebGL2 context initialized");
  logger.info("Shaders compiled successfully");
  logger.warn("Texture memory usage high");
  logger.groupEnd();

  // Test collapsed group
  logger.groupCollapsed("Performance Metrics", LogColors.LIME);
  logger.info("FPS: 60");
  logger.info("Draw calls: 42");
  logger.info("Memory usage: 128MB");
  logger.groupEnd();

  // Test table logging
  const gameStats = {
    fps: 60,
    drawCalls: 42,
    triangles: 15000,
    memoryUsage: "128MB",
  };
  logger.table(gameStats, LogColors.INFO);

  // Test timing
  logger.time("Render Frame");
  // Simulate some work
  setTimeout(() => {
    logger.timeEnd("Render Frame");
  }, 10);

  // Test assertions
  logger.assert(true, "This assertion should pass");
  logger.assert(false, "This assertion should fail and show an error");

  // Test counting
  logger.count("Frame");
  logger.count("Frame");
  logger.count("Frame");
  logger.countReset("Frame");
  logger.count("Frame");

  // Test different log levels
  console.log("\n=== Testing Log Levels ===");

  // Create a new logger instance with different config
  const debugLogger = Logger.getInstance({
    level: LogLevel.DEBUG,
    prefix: "DEBUG",
    enableColors: true,
    enableTimestamps: false,
  });

  debugLogger.debug("Debug level message (should show)");
  debugLogger.info("Info level message (should show)");

  // Create a logger with higher level
  const errorOnlyLogger = Logger.getInstance();
  errorOnlyLogger.setLevel(LogLevel.ERROR);
  errorOnlyLogger.setPrefix("ERROR_ONLY");

  errorOnlyLogger.debug("Debug message (should NOT show)");
  errorOnlyLogger.info("Info message (should NOT show)");
  errorOnlyLogger.warn("Warning message (should NOT show)");
  errorOnlyLogger.error("Error message (should show)");

  // Test disabling colors
  console.log("\n=== Testing Without Colors ===");
  const plainLogger = Logger.getInstance();
  plainLogger.setColorsEnabled(false);
  plainLogger.info("This message should appear without colors");
  plainLogger.error("This error should appear without colors");

  // Re-enable colors for future use
  plainLogger.setColorsEnabled(true);

  // Test development mode toast notifications for errors
  console.log("\n=== Testing Development Mode Toast Notifications ===");
  if (import.meta.env.DEV) {
    console.log(
      "Development mode detected - error logs should trigger toast notifications"
    );
    logger.error(
      "Test error message - this should show both console log and toast in dev mode"
    );
  } else {
    console.log("Production mode - error logs will only show in console");
    logger.error(
      "Test error message - this should only show in console in production mode"
    );
  }

  console.log("\n=== Logger Test Complete ===");
}
