import { Canvas, Color } from "./graphics";
import { Content } from "./content";
import { Scene } from "./scenes/Scene";
import { logger, LogColors, LogLevel } from "./utils";
import { GameLoop } from "./GameLoop";
import { GraphicsBackendType, ActualBackendType } from "./graphics/Graphics";
import { AudioContext } from "./audio";
import { InputManager, Keys } from "./input";
import {
  EmptyScene,
  InputTestScene,
  MouseTestScene,
  GamepadTestScene,
  PerfTestScene,
  SpriteTestScene,
  PrimitivesTestScene,
  FontTestScene,
  AudioTestScene,
  DefaultTextureTestScene,
} from "./scenes";

interface GameConfig {
  canvas: {
    width: number;
    height: number;
  };
  game: {
    name: string;
    preferredBackend: string;
    startScene: string;
  };
  input: {
    keyboard: boolean;
    mouse: boolean;
    gamepad: boolean;
    preventDefaults: Keys[];
    mousePreventDefaults: ("mousedown" | "mouseup" | "wheel" | "contextmenu")[];
    gamepadDeadzone: number;
    gamepadTriggerDeadzone: number;
  };
  debugging: {
    input: boolean;
    graphics: boolean;
    audio: boolean;
  };
  audio: {
    enabled: boolean;
  };
  logging: {
    level: string;
  };
}

type SceneConstructor = new (canvas: Canvas, content: Content) => Scene;

export class Game {
  private canvas: Canvas;
  private content: Content;
  private gameLoop: GameLoop;
  private audio: AudioContext;
  private input: InputManager;
  private running: boolean = false;
  private waitingForUserInteraction: boolean = false;

  // Scene management
  private currentScene: Scene | null = null;
  private sceneRegistry: Map<string, SceneConstructor> = new Map();

  constructor() {
    // These will be initialized in initialize() after loading config
    this.canvas = null as any;
    this.content = Content.getInstance();
    this.gameLoop = GameLoop.getInstance();
    this.audio = AudioContext.getInstance();
    this.input = InputManager.getInstance();

    // Register default scenes
    this.registerExampleScenes();
  }

  private registerExampleScenes(): void {
    this.sceneRegistry.set("EmptyScene", EmptyScene);
    this.sceneRegistry.set("InputTestScene", InputTestScene);
    this.sceneRegistry.set("MouseTestScene", MouseTestScene);
    this.sceneRegistry.set("GamepadTestScene", GamepadTestScene);
    this.sceneRegistry.set("PerfTestScene", PerfTestScene);
    this.sceneRegistry.set("SpriteTestScene", SpriteTestScene);
    this.sceneRegistry.set("PrimitivesTestScene", PrimitivesTestScene);
    this.sceneRegistry.set("FontTestScene", FontTestScene);
    this.sceneRegistry.set("AudioTestScene", AudioTestScene);
    this.sceneRegistry.set("DefaultTextureTestScene", DefaultTextureTestScene);
  }

  private createScene(sceneName: string): Scene | null {
    const SceneClass = this.sceneRegistry.get(sceneName);
    if (!SceneClass) {
      logger.error(`Scene '${sceneName}' not found in registry`);
      return null;
    }
    return new SceneClass(this.canvas, this.content);
  }

  private async loadGameConfig(): Promise<GameConfig> {
    const response = await fetch("/game.json");
    if (!response.ok) {
      throw new Error("Failed to load game configuration");
    }

    const rawConfig = await response.json();

    // Parse and validate the configuration
    const config: GameConfig = {
      canvas: {
        width: rawConfig.canvas?.width ?? 800,
        height: rawConfig.canvas?.height ?? 600,
      },
      game: {
        name: rawConfig.game?.name ?? "Game Stage AI",
        preferredBackend: rawConfig.game?.preferredBackend ?? "Auto",
        startScene: rawConfig.game?.startScene ?? "EmptyScene",
      },
      input: {
        keyboard: rawConfig.input?.keyboard ?? true,
        mouse: rawConfig.input?.mouse ?? true,
        gamepad: rawConfig.input?.gamepad ?? true,
        preventDefaults: rawConfig.input?.preventDefaults ?? [],
        mousePreventDefaults: rawConfig.input?.mousePreventDefaults ?? [],
        gamepadDeadzone: rawConfig.input?.gamepadDeadzone ?? 0.1,
        gamepadTriggerDeadzone: rawConfig.input?.gamepadTriggerDeadzone ?? 0.05,
      },
      debugging: {
        input: rawConfig.debugging?.input ?? false,
        graphics: rawConfig.debugging?.graphics ?? false,
        audio: rawConfig.debugging?.audio ?? false,
      },
      audio: {
        enabled: rawConfig.audio?.enabled ?? true,
      },
      logging: {
        level: rawConfig.logging?.level ?? "debug",
      },
    };

    return config;
  }

  private parseBackendType(backendString: string): GraphicsBackendType {
    switch (backendString.toLowerCase()) {
      case "webgpu":
        return GraphicsBackendType.WebGPU;
      case "webgl2":
        return GraphicsBackendType.WebGL2;
      case "auto":
      default:
        return GraphicsBackendType.Auto;
    }
  }

  private parseLogLevel(levelString: string): LogLevel {
    switch (levelString.toLowerCase()) {
      case "debug":
        return LogLevel.DEBUG;
      case "info":
        return LogLevel.INFO;
      case "warn":
        return LogLevel.WARN;
      case "error":
        return LogLevel.ERROR;
      default:
        return LogLevel.DEBUG;
    }
  }

  async initialize(): Promise<boolean> {
    logger.info("Loading game configuration...", LogColors.CYAN);

    let config: GameConfig;
    try {
      config = await this.loadGameConfig();

      // Set the page title to the game name
      document.title = config.game.name;

      // Initialize canvas with config
      this.canvas = new Canvas(
        config.canvas.width,
        config.canvas.height,
        this.parseBackendType(config.game.preferredBackend),
        undefined,
        config.debugging.graphics
      );

      // Initialize graphics system
      const graphicsInitialized = await this.canvas.initialize();
      if (!graphicsInitialized) {
        logger.error(
          "Unable to initialize graphics system. Please ensure your browser supports WebGPU or WebGL2 and try refreshing the page."
        );
        return false;
      }
      logger.success("Canvas initialized successfully");

      // Initialize input with config and canvas
      this.input.initialize(
        {
          ...config.input,
          debug: config.debugging.input,
        },
        this.canvas
      );

      // Set logging level
      logger.setPrefix(`[${config.game.name}]`);
      logger.setLevel(this.parseLogLevel(config.logging.level));

      logger.success("Game configuration loaded successfully");
    } catch (error) {
      logger.error(`Failed to load game configuration: ${error}`);
      return false;
    }

    logger.info("Initializing game systems...", LogColors.CYAN);

    // Log detailed graphics backend information
    this.canvas.logBackendInfo();

    // Initialize audio system
    const audioInitialized = await this.audio.initialize(
      config.debugging.audio
    );
    if (audioInitialized) {
      const policy = this.audio.getAutoplayPolicy();
      if (policy) {
        logger.info(
          `Audio system initialized (autoplay policy: ${policy})`,
          LogColors.INFO
        );
      } else {
        logger.info("Audio system initialized successfully", LogColors.INFO);
      }

      // Check if we need user interaction to start audio
      if (this.audio.suspended) {
        this.waitingForUserInteraction = true;
        this.setupUserInteractionListeners();
        logger.info(
          "Waiting for user interaction to start audio and game",
          LogColors.INFO
        );
      }
    } else {
      logger.warn("Audio system failed to initialize", LogColors.WARN);
    }

    // Load the start scene
    logger.info("Loading start scene...", LogColors.CYAN);
    const startSceneLoaded = await this.loadStartScene(config.game.startScene);
    if (!startSceneLoaded) {
      logger.error("Failed to load start scene, falling back to EmptyScene");
      const fallbackLoaded = await this.loadStartScene("EmptyScene");
      if (!fallbackLoaded) {
        logger.error("Critical: Failed to load even the EmptyScene fallback!");
        return false;
      }
    }

    logger.groupEnd();
    return true;
  }

  private async loadStartScene(sceneName: string): Promise<boolean> {
    const scene = this.createScene(sceneName);
    if (!scene) {
      return false;
    }

    const initialized = await scene.initialize();
    if (initialized) {
      this.currentScene = scene;
      logger.success(`Start scene '${sceneName}' loaded successfully`);
      return true;
    } else {
      logger.error(`Failed to initialize scene '${sceneName}'`);
      return false;
    }
  }

  /**
   * Load a new scene, cleaning up the previous one
   * @param scene The scene to load
   */
  async loadScene(scene: Scene): Promise<boolean> {
    // Clean up current scene
    if (this.currentScene) {
      this.currentScene.cleanup();
    }

    // Initialize new scene
    const initialized = await scene.initialize();
    if (initialized) {
      this.currentScene = scene;
      logger.info("Scene loaded successfully", LogColors.SUCCESS);
      return true;
    } else {
      logger.error("Failed to initialize scene");
      return false;
    }
  }

  // Internal methods called by GameLoop
  internalUpdate(deltaTime: number): void {
    if (!this.waitingForUserInteraction) {
      // Update input system first (only after user interaction)
      this.input.update(deltaTime * 1000); // Convert seconds to milliseconds

      if (this.currentScene) {
        this.currentScene.update(deltaTime * 1000); // Convert seconds to milliseconds
      }
    }
  }

  internalFixedUpdate(deltaTime: number): void {
    if (this.currentScene) {
      this.currentScene.fixedUpdate(deltaTime * 1000); // Convert seconds to milliseconds
    }
  }

  internalDraw(interpolationFactor: number): void {
    // Begin frame
    this.canvas.beginFrame();

    // If waiting for user interaction, show the interact to play message
    if (this.waitingForUserInteraction) {
      this.drawInteractToPlay();
    } else {
      if (this.currentScene) {
        this.currentScene.render(interpolationFactor);
      }
    }

    // End frame
    this.canvas.endFrame();
  }

  run(): void {
    if (this.running) return;

    logger.info("Starting game loop...", LogColors.SUCCESS);
    this.running = true;

    // Start the new game loop
    this.gameLoop.start(this);
  }

  stop(): void {
    logger.info("Stopping game...", LogColors.WARN);
    this.running = false;

    // Stop the game loop
    this.gameLoop.terminate();

    // Clean up current scene
    if (this.currentScene) {
      this.currentScene.cleanup();
      this.currentScene = null;
    }

    // Clean up content resources
    this.content.unloadAll();

    // Clean up audio resources
    this.audio.dispose();

    // Clean up input system and event listeners
    this.input.destroy();

    logger.info("Game stopped and resources cleaned up", LogColors.INFO);
  }

  get contentManager(): Content {
    return this.content;
  }

  /**
   * Get the audio context for audio management
   */
  get audioContext(): AudioContext {
    return this.audio;
  }

  /**
   * Get the input manager for input handling
   */
  get inputManager(): InputManager {
    return this.input;
  }

  /**
   * Get the canvas for direct rendering access
   */
  get gameCanvas(): Canvas {
    return this.canvas;
  }

  // Getter and setter for fixedTimeStep (update/physics rate)
  get targetFixedTimeStepRate(): number {
    return this.gameLoop.updateRate;
  }

  set targetFixedTimeStepRate(fps: number) {
    if (fps <= 0) {
      throw new Error("FPS must be greater than 0");
    }
    this.gameLoop.updateRate = fps;
  }

  /**
   * Get the current active scene
   */
  get scene(): Scene | null {
    return this.currentScene;
  }

  /**
   * Access to the game loop for advanced configuration
   */
  get loop(): GameLoop {
    return this.gameLoop;
  }

  /**
   * Get the current graphics backend type
   */
  get graphicsBackend(): ActualBackendType {
    return this.canvas.backendType;
  }

  /**
   * Get the requested graphics backend type
   */
  get requestedGraphicsBackend(): GraphicsBackendType {
    return this.canvas.requestedBackendType;
  }

  /**
   * Set up event listeners for user interaction to resume audio
   */
  private setupUserInteractionListeners(): void {
    const handleUserInteraction = async (event: Event) => {
      event.preventDefault();

      try {
        // Resume audio context
        await this.audio.resume();
        this.waitingForUserInteraction = false;

        // Clean up event listeners
        document.removeEventListener("click", handleUserInteraction);
        document.removeEventListener("keydown", handleUserInteraction);
        document.removeEventListener("touchstart", handleUserInteraction);

        logger.success("Audio resumed, game started!");
      } catch (error) {
        logger.error("Failed to resume audio: " + String(error));
      }
    };

    // Listen for various user interaction events
    document.addEventListener("click", handleUserInteraction);
    document.addEventListener("keydown", handleUserInteraction);
    document.addEventListener("touchstart", handleUserInteraction);
  }

  /**
   * Draw the "Interact to Play" message
   */
  private drawInteractToPlay(): void {
    // Get canvas dimensions
    const width = this.canvas.width;
    const height = this.canvas.height;

    const text = "Click or press any button to Play!";

    const textMeasure = this.canvas.measureText(text);

    this.canvas.pushTransform();
    const textScale = 2;
    this.canvas.scale(textScale, textScale);
    const canvasCenter = this.canvas.getCenterPoint();
    this.canvas.fillRect(0, 0, width, height, Color.BLACK.withA(0.9));
    this.canvas.drawText(
      text,
      canvasCenter.x - textMeasure.width / 2,
      canvasCenter.y - textMeasure.height / 2,
      Color.WHITE
    );
    this.canvas.popTransform();
  }
}
