import {
  testGraphicsBackend,
  testAllGraphicsBackends,
} from "./graphics-backend-test";
import { testLogger } from "./logger-test";
import { testMatrix } from "./matrix-test";
import { testColor } from "./color-test";
import {
  testFontLoading,
  testFontMeasurement,
  testFontRendering,
  testFontAtlas,
  testFontPerformance,
  testAllFonts,
} from "./fonts-test";
import { Logger } from "../utils/Logger";
import { Color } from "../graphics/Color";
import { GraphicsBackendType } from "../graphics/Graphics";

/**
 * Test metadata for UI generation
 */
interface TestMetadata {
  id: string;
  name: string;
  description: string;
  icon: string;
  testFunction: () => Promise<void> | void;
}

/**
 * Central test registry - single source of truth for all tests
 */
const TEST_REGISTRY: TestMetadata[] = [
  {
    id: "color",
    name: "Color Test",
    description: "Test Color class and Flyweight pattern",
    icon: "🎨",
    testFunction: testColor,
  },
  {
    id: "logger",
    name: "Logger Test",
    description: "Test Logger functionality",
    icon: "📝",
    testFunction: testLogger,
  },
  {
    id: "matrix",
    name: "Matrix Test",
    description: "Test Matrix utility class",
    icon: "🧮",
    testFunction: testMatrix,
  },
  {
    id: "font-loading",
    name: "Font Loading Test",
    description: "Test font loading and basic properties",
    icon: "📂",
    testFunction: testFontLoading,
  },
  {
    id: "font-measurement",
    name: "Font Measurement Test",
    description: "Test text measurement functionality",
    icon: "📏",
    testFunction: testFontMeasurement,
  },
  {
    id: "font-atlas",
    name: "Font Atlas Test",
    description: "Test font atlas and texture generation",
    icon: "🔤",
    testFunction: testFontAtlas,
  },
  {
    id: "font-performance",
    name: "Font Performance Test",
    description: "Test font performance with large text rendering",
    icon: "⚡",
    testFunction: testFontPerformance,
  },
  {
    id: "font-rendering",
    name: "Font Rendering Test",
    description: "Test font rendering with different properties",
    icon: "🎨",
    testFunction: testFontRendering,
  },
  {
    id: "fonts-all",
    name: "All Font Tests",
    description: "Run all font system tests",
    icon: "🔠",
    testFunction: testAllFonts,
  },
  {
    id: "graphics",
    name: "Graphics Test (All)",
    description: "Test all graphics backends",
    icon: "🎮",
    testFunction: testAllGraphicsBackends,
  },
  {
    id: "graphics-auto",
    name: "Graphics Auto",
    description: "Test auto backend selection",
    icon: "🔧",
    testFunction: () => testGraphicsBackend(GraphicsBackendType.Auto),
  },
  {
    id: "graphics-webgl2",
    name: "Graphics WebGL2",
    description: "Test WebGL2 backend",
    icon: "🌐",
    testFunction: () => testGraphicsBackend(GraphicsBackendType.WebGL2),
  },
  {
    id: "graphics-webgpu",
    name: "Graphics WebGPU",
    description: "Test WebGPU backend",
    icon: "⚡",
    testFunction: () => testGraphicsBackend(GraphicsBackendType.WebGPU),
  },
];

/**
 * Main test runner function
 */
export async function runAllTests(): Promise<void> {
  const logger = Logger.getInstance();

  logger.info("🚀 Starting Game Stage AI Test Suite", Color.fromHex("#FFD700"));
  logger.info("=".repeat(50), Color.fromHex("#FFD700"));

  try {
    // Get core tests to run (excluding debug tests for main suite)
    const coreTests = [
      "color",
      "logger",
      "matrix",
      "font",
      "font-measure",
      "text-area",
      "graphics",
    ];

    for (const testId of coreTests) {
      const testMeta = getTestMetadata(testId);
      const displayName = testMeta
        ? `${testMeta.icon} ${testMeta.name}`
        : testId;

      logger.info(`🔍 Running ${displayName}...`, Color.fromHex("#00AAFF"));

      try {
        await runTest(testId);
        logger.info(`✅ ${displayName}: Completed`, Color.fromHex("#44FF44"));
      } catch (error) {
        logger.error(
          `❌ ${displayName}: Failed - ${error}`,
          Color.fromHex("#FF4444")
        );
        throw error;
      }
    }

    // Summary
    logger.info("=".repeat(50), Color.fromHex("#FFD700"));
    logger.success(
      "🎉 All tests completed successfully!",
      Color.fromHex("#44FF44")
    );
  } catch (error) {
    logger.error(`❌ Test suite failed: ${error}`, Color.fromHex("#FF4444"));
    console.error(error);
    throw error;
  }
}

/**
 * Run individual test by name
 */
export async function runTest(testName: string): Promise<void> {
  const logger = Logger.getInstance();

  // Find test metadata
  const testMeta = getTestMetadata(testName.toLowerCase());
  if (!testMeta) {
    logger.error(`Unknown test: ${testName}`, Color.fromHex("#FF4444"));
    const availableTestIds = TEST_REGISTRY.map((test) => test.id).join(", ");
    logger.info(
      `Available tests: ${availableTestIds}`,
      Color.fromHex("#FFAA00")
    );
    return;
  }

  // Execute the test function
  await testMeta.testFunction();
}

/**
 * Display available tests
 */
export function listTests(): void {
  const logger = Logger.getInstance();

  logger.info("📋 Available Tests:", Color.fromHex("#FFD700"));

  TEST_REGISTRY.forEach((test) => {
    logger.info(
      `  • ${test.id} - ${test.description}`,
      Color.fromHex("#AAAAAA")
    );
  });
}

/**
 * Get available tests in a structured format for dynamic UI generation
 */
export function getAvailableTests(): TestMetadata[] {
  return TEST_REGISTRY;
}

/**
 * Get the primary tests for the main UI (all tests from registry)
 */
export function getPrimaryTests(): TestMetadata[] {
  return TEST_REGISTRY;
}

/**
 * Get test metadata by ID
 */
function getTestMetadata(testId: string): TestMetadata | undefined {
  return TEST_REGISTRY.find((test) => test.id === testId);
}
