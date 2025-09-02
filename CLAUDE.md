# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Game Stage AI is a TypeScript-based 2D game engine designed for web browsers, supporting both WebGPU and WebGL2 graphics backends with automatic fallback. The engine features a modular architecture with scene management, asset loading, and a sophisticated game loop.

## Core Commands

**Development:**

- `npm run dev` - Start development server on port 3000 (NEVER run this command - user will always run it themselves)
- `npm run build` - Build for production (runs TypeScript compiler + Vite build)
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript type checking without emitting files

**Testing:**

- Open `tests.html` in browser for comprehensive test dashboard
- Individual tests can be run via the test dashboard UI
- Test runner is located at `src/test/test-runner.ts`

## Architecture

### Graphics System

- **Multi-backend support**: WebGPU (preferred) and WebGL2 (fallback)
- **Graphics class**: Singleton facade managing active backend (`src/graphics/Graphics.ts`)
- **Backend implementations**:
  - WebGPU: `src/graphics/webgpu/`
  - WebGL2: `src/graphics/webgl2/`
- **Rendering pipeline**: Canvas → Graphics → Backend-specific implementations

### Core Components

- **Game class**: Main game instance with scene management (`src/Game.ts`)
- **GameLoop**: Fixed timestep game loop with VSync snapping (`src/GameLoop.ts`)
- **Scene system**: Base Scene class with test scenes in `src/scenes/`
- **Content system**: Asset management with loaders (`src/content/`)
- **Audio system**: High-performance audio management (`src/audio/`, `src/content/`)

### Key Systems

- **Logger**: Centralized logging with color support (`src/utils/Logger.ts`)
- **Matrix**: 3D transformation utilities (`src/utils/Matrix.ts`)
- **Color**: Flyweight pattern implementation (`src/graphics/Color.ts`)
- **Platform**: Browser environment abstraction (`src/utils/Platform.ts`)

### Test Suite

- Comprehensive test dashboard accessible via `tests.html`
- Test categories: Graphics backends, Color, Logger, Matrix, Font rendering, Text performance
- All tests are registered in `src/test/test-runner.ts` with metadata for UI generation

## Entry Points

- **Main application**: `src/main.ts` - Initializes Game instance with WebGPU preference
- **Test dashboard**: `tests.html` - Interactive test runner with live console output

## Development Notes

- Engine defaults to WebGPU but gracefully falls back to WebGL2
- Fixed timestep at 60 FPS with variable rendering interpolation
- Asset loading managed through Content singleton
- Scene lifecycle: initialize → update/fixedUpdate → draw → cleanup

## Audio System

The engine features a comprehensive audio system optimized for game performance:

### **Architecture**

- **AudioContext**: Singleton wrapper for Web Audio API with gain node management (`src/audio/AudioContext.ts`)
- **AudioLoader**: High-performance audio buffer caching system (`src/content/AudioLoader.ts`)
- **Song**: Background music asset with looping and fade support (`src/content/Song.ts`)
- **SoundEffect**: Short audio clips with object pooling for performance (`src/content/SoundEffect.ts`)

### **Key Features**

- **Performance Optimized**: AudioBuffer caching, source node pooling, minimal hot-path allocations
- **Multi-channel Volume Control**: Separate gain nodes for master, music, and SFX
- **Asset Integration**: Songs and sound effects load through Content system with bundle support
- **Web Audio Best Practices**: Proper node graph management, single-use source nodes
- **Memory Efficient**: Buffer reuse, pool size limits, automatic cleanup

### **Audio Asset Types**

```json
{
  "type": "song",
  "path": "assets/audio/music.ogg",
  "volume": 0.7,
  "loop": true
}

{
  "type": "soundeffect",
  "path": "assets/audio/jump.wav",
  "volume": 0.9,
  "poolSize": 4
}
```

### **Usage Examples**

```typescript
// Load audio bundle
await content.loadBundle("audio-test");

// Get and play assets
const bgMusic = content.getSong("background-music");
const jumpSfx = content.getSoundEffect("jump-sound");

bgMusic.play(0.5); // 0.5s fade-in
jumpSfx.playWithPitch(0.2); // pitch variation
```

### **Testing**

- **AudioTestScene**: Interactive test scene with keyboard controls (`src/scenes/AudioTestScene.ts`)
- Real-time status display and volume controls
- Tests buffer caching, pooling, and concurrent playback
