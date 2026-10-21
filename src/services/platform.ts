import { Capacitor } from '@capacitor/core'

/** True inside the Capacitor Android/iOS app, false in a browser (PWA). */
export const isNative = Capacitor.isNativePlatform()
