import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pokedex.app',
  appName: 'Pokédex',
  webDir: 'www',
  server: {
    // getUserMedia necesita un contexto seguro dentro del WebView
    androidScheme: 'https',
  },
};

export default config;
