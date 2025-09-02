# Game Stage AI

A modern TypeScript-based 2D game engine designed for web browsers, featuring dual graphics backend support (WebGPU/WebGL2), comprehensive asset management, and high-performance audio systems.

## 🚀 Features

### Graphics
- **Dual Backend Support**: WebGPU (preferred) with automatic WebGL2 fallback
- **Hardware Accelerated**: Optimized rendering pipeline for maximum performance
- **Cross-Browser Compatible**: Works across modern browsers with graceful degradation

### Audio
- **Web Audio API Integration**: High-performance audio with buffer caching
- **Smart Pooling**: Object pooling for sound effects to minimize garbage collection
- **Multi-Channel Mixing**: Separate volume controls for master, music, and SFX
- **Fade Support**: Built-in fade in/out transitions for music

### Asset Management
- **Bundle System**: Efficient asset loading with bundle management
- **Multi-Format Support**: Images, audio files, fonts, and shaders
- **Caching Strategy**: Intelligent caching for optimal performance
- **Loading Progress**: Real-time loading progress tracking

### Development
- **TypeScript First**: Full TypeScript support with strict typing
- **Hot Reload**: Vite-powered development server with instant updates
- **Test Suite**: Comprehensive interactive test dashboard
- **Configurable**: JSON-based configuration system

## 🛠️ Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd game-stage-ai

# Install dependencies
npm install
```

## 🏃‍♂️ Quick Start

```bash
# Start development server
npm run dev

# Open browser to http://localhost:5173
```

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production (includes font generation) |
| `npm run preview` | Preview production build |
| `npm run type-check` | Run TypeScript type checking |
| `npm run generate-fonts` | Generate font pattern assets |

## 🧪 Testing

Open `tests.html` in your browser to access the interactive test dashboard featuring:

- **Graphics Backend Tests**: WebGPU/WebGL2 compatibility testing
- **Performance Tests**: Frame rate and rendering performance
- **Audio Tests**: Sound playback and mixing capabilities
- **Input Tests**: Keyboard, mouse, and gamepad input
- **Font Rendering**: Typography and text rendering tests

## 🏗️ Architecture

### Core Components

```
src/
├── Game.ts           # Main game instance and scene management
├── GameLoop.ts       # Fixed timestep game loop (60 FPS)
├── main.ts           # Application entry point
├── graphics/         # Dual backend graphics system
├── audio/            # Web Audio API integration
├── content/          # Asset loading and management
├── scenes/           # Scene system with test scenes
├── input/            # Input handling (keyboard/mouse/gamepad)
└── utils/            # Utilities (logger, matrix, platform)
```

### Graphics Pipeline

1. **Canvas** → Creates rendering context
2. **Graphics** → Singleton facade managing backends
3. **Backend** → WebGPU or WebGL2 implementation
4. **Rendering** → Optimized draw calls and state management

### Scene System

```typescript
// Example scene implementation
export class MyScene extends Scene {
  async initialize(): Promise<boolean> {
    // Load assets, initialize scene objects
    return true;
  }

  update(deltaTime: number): void {
    // Game logic updates
  }

  fixedUpdate(fixedDeltaTime: number): void {
    // Physics and fixed timestep logic
  }

  draw(): void {
    // Rendering calls
  }
}
```

## ⚙️ Configuration

Game behavior is controlled via `game.json`:

```json
{
  "canvas": {
    "width": 1024,
    "height": 768
  },
  "game": {
    "name": "Game Stage AI",
    "preferredBackend": "WebGPU",
    "startScene": "PerfTestScene"
  },
  "input": {
    "keyboard": true,
    "mouse": true,
    "gamepad": true,
    "gamepadDeadzone": 0.1
  },
  "audio": {
    "enabled": true
  }
}
```

## 🎵 Audio System

### Asset Definition

```json
{
  "assets": [
    {
      "name": "background-music",
      "type": "song",
      "path": "assets/audio/music.ogg",
      "volume": 0.7,
      "loop": true
    },
    {
      "name": "jump-sound",
      "type": "soundeffect",
      "path": "assets/audio/jump.wav",
      "volume": 0.9,
      "poolSize": 4
    }
  ]
}
```

### Usage

```typescript
// Load audio assets
await content.loadBundle("audio-bundle");

// Play background music with fade-in
const bgMusic = content.getSong("background-music");
bgMusic.play(0.5); // 0.5 second fade-in

// Play sound effect with pitch variation
const jumpSfx = content.getSoundEffect("jump-sound");
jumpSfx.playWithPitch(0.2); // ±20% pitch variation
```

## 🎮 Input System

Supports multiple input methods with configurable prevention of browser defaults:

```typescript
// Keyboard input
if (input.isKeyPressed(Keys.Space)) {
  // Handle spacebar press
}

// Mouse input
const mousePos = input.getMousePosition();
if (input.isMouseButtonPressed(0)) {
  // Handle left click
}

// Gamepad input
const gamepad = input.getGamepad(0);
if (gamepad?.isButtonPressed(0)) {
  // Handle gamepad button A
}
```

## 🔧 Development

### Project Structure

- **Modular Design**: Each system is self-contained with clear interfaces
- **Singleton Pattern**: Core systems use singleton pattern for global access
- **Asset Bundles**: Organize assets into loadable bundles
- **Scene Management**: Switch between different game states/screens

### Browser Support

- **WebGPU**: Chrome 113+, Edge 113+
- **WebGL2**: All modern browsers
- **Fallback Strategy**: Automatic detection and graceful degradation

### Performance Considerations

- Fixed timestep game loop prevents frame rate dependent behavior
- Object pooling for frequently created/destroyed objects
- Efficient asset caching and loading strategies
- Optimized rendering with minimal state changes

## 📄 License

This project is private and not licensed for public use.

## 🤝 Contributing

This is a private project. Contact the maintainer for contribution guidelines.

---

Built with ❤️ using TypeScript, Vite, and modern web technologies.
