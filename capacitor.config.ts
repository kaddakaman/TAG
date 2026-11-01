import type { CapacitorConfig } from '@capacitor/cli';

// Wraps the web game in a native Android app (see android/ and the README).
const config: CapacitorConfig = {
  appId: 'com.kaddakaman.tag',
  appName: 'TAG',
  webDir: 'dist',
  backgroundColor: '#120e0a',
  android: {
    // Gamepads, touch and audio all work inside the Android WebView.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SystemBars: {
      // Full screen; also exposes --safe-area-inset-* CSS variables for phones with notches.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
      hidden: true,
    },
  },
};

export default config;
