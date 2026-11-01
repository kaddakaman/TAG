import './style.css';
import { Game } from './game';
import { UI } from './ui/ui';
import { initNative, isNative } from './native';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const root = document.getElementById('ui') as HTMLElement;
const game = new Game(canvas);
const ui = new UI(game, root);
game.attachUI(ui);
game.start();
initNative(game);

// Expose for debugging and automated smoke tests
(window as any).TAG = game;

// Offline caching for the browser version (the Android app already has its files built in)
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNative) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
