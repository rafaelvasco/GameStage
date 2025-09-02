// Debug script to test WebGL2 initialization step by step

import { Logger } from "../utils/Logger";
import { Color } from "../graphics/Color";

export function debugWebGL2(): void {
  const logger = Logger.getInstance();

  logger.info("🔍 WebGL2 Debug Test", Color.fromHex("#FFD700"));

  try {
    // Step 1: Check if WebGL2 is supported
    logger.info("Step 1: Checking WebGL2 support...", Color.fromHex("#00AAFF"));
    const testCanvas = document.createElement("canvas");
    const gl = testCanvas.getContext("webgl2");

    if (!gl) {
      logger.error("WebGL2 is not supported", Color.fromHex("#FF4444"));
      return;
    }

    logger.success("WebGL2 is supported", Color.fromHex("#44FF44"));

    // Step 2: Log WebGL2 info
    logger.info("Step 2: WebGL2 Information", Color.fromHex("#00AAFF"));
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

    // Step 3: Test basic WebGL2 operations
    logger.info(
      "Step 3: Testing basic WebGL2 operations...",
      Color.fromHex("#00AAFF")
    );

    // Create a simple vertex shader
    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Create a simple fragment shader
    const fragmentShaderSource = `#version 300 es
      precision mediump float;
      out vec4 fragColor;
      void main() {
        fragColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `;

    // Test shader compilation
    logger.info(
      "Testing vertex shader compilation...",
      Color.fromHex("#888888")
    );
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) {
      throw new Error("Failed to create vertex shader");
    }

    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(vertexShader);
      throw new Error(`Vertex shader compilation failed: ${error}`);
    }

    logger.success(
      "Vertex shader compiled successfully",
      Color.fromHex("#44FF44")
    );

    logger.info(
      "Testing fragment shader compilation...",
      Color.fromHex("#888888")
    );
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      throw new Error("Failed to create fragment shader");
    }

    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(fragmentShader);
      throw new Error(`Fragment shader compilation failed: ${error}`);
    }

    logger.success(
      "Fragment shader compiled successfully",
      Color.fromHex("#44FF44")
    );

    // Test program linking
    logger.info("Testing shader program linking...", Color.fromHex("#888888"));
    const program = gl.createProgram();
    if (!program) {
      throw new Error("Failed to create shader program");
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      throw new Error(`Program linking failed: ${error}`);
    }

    logger.success(
      "Shader program linked successfully",
      Color.fromHex("#44FF44")
    );

    // Test buffer creation
    logger.info("Testing buffer creation...", Color.fromHex("#888888"));
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error("Failed to create buffer");
    }

    logger.success("Buffer created successfully", Color.fromHex("#44FF44"));

    // Test VAO creation
    logger.info("Testing VAO creation...", Color.fromHex("#888888"));
    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error("Failed to create VAO");
    }

    logger.success("VAO created successfully", Color.fromHex("#44FF44"));

    // Test texture creation
    logger.info("Testing texture creation...", Color.fromHex("#888888"));
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("Failed to create texture");
    }

    logger.success("Texture created successfully", Color.fromHex("#44FF44"));

    // Test sampler creation
    logger.info("Testing sampler creation...", Color.fromHex("#888888"));
    const sampler = gl.createSampler();
    if (!sampler) {
      throw new Error("Failed to create sampler");
    }

    logger.success("Sampler created successfully", Color.fromHex("#44FF44"));

    // Clean up
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    gl.deleteProgram(program);
    gl.deleteBuffer(buffer);
    gl.deleteVertexArray(vao);
    gl.deleteTexture(texture);
    gl.deleteSampler(sampler);

    logger.success("🎉 All WebGL2 tests passed!", Color.fromHex("#44FF44"));
  } catch (error) {
    logger.error(
      `WebGL2 debug test failed: ${error}`,
      Color.fromHex("#FF4444")
    );
  }
}
