// Integration with the Android app shell (Capacitor). Does nothing in a browser.

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import type { Game } from './game';

export const isNative = Capacitor.isNativePlatform();

export function initNative(game: Game): void {
  if (!isNative) return;
  document.documentElement.classList.add('native');
  // Android's Back button: close menus / go back, or pause the game - never quit by accident.
  void App.addListener('backButton', () => {
    if (!game.ui.handleBack()) void App.minimizeApp();
  });
  // Save whenever the app is sent to the background.
  void App.addListener('pause', () => game.save());
}
