import './style.css';
import { Game } from './game/Game';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

if (!canvas) {
  throw new Error('Canvas element not found');
}

const game = new Game(canvas);
game.start();
