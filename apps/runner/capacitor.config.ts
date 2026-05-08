import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.govakreality.gudrun',
  appName: 'gudrun',
  webDir: 'dist',
  server: {
    url: 'http://192.168.0.9:8080',
    cleartext: true
  }
};

export default config;
