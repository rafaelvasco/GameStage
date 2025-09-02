import "./style.css";
import { Game } from "./Game";

async function main() {
  const game = new Game();

  // Initialize game (this will load config and start scene)
  const initialized = await game.initialize();
  if (!initialized) {
    console.error("Failed to initialize game");
    return;
  }

  // Start the game loop
  game.run();
}

// Start the application
main();
