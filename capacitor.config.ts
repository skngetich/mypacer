import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.github.skngetich.mypacer',
  appName: 'MyPacer',
  webDir: 'dist',
  android: {
    // Keeps background location updates flowing past 5 minutes (background-geolocation#89).
    useLegacyBridge: true,
  },
}

export default config
