import './style.css';
import { Game } from './game';
import { UI } from './ui/ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const root = document.getElementById('ui') as HTMLElement;
const game = new Game(canvas);
const ui = new UI(game, root);
game.attachUI(ui);
game.start();

// Expose for debugging and automated smoke tests
(window as any).TAG = game;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
