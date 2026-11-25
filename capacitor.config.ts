import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ricochetfoundry.ballgame',
  appName: 'Ricochet Foundry',
  webDir: 'dist',
  android: {
    backgroundColor: '#0B1120',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
