# MyPacer

A PWA that tracks your run with GPS and **tells you your pace out loud**, so you never have to look at your phone.

## Features

- **Voice pace updates.** Current pace is a rolling average over the last 30 s. You can get it:
  - every N km or miles (0.25–5)
  - every N minutes (1–15)
  - by tapping the big pace number, even on the lock screen
  - as target-pace alerts: "Speed up" or "Slow down" when you leave target ± tolerance. Alerts start after the first minute and play at most every 30 s. You hear "Back on target" when you return to range.
- **Auto-pause** at traffic lights. Paused time and distance are excluded.
- **Screen stays on** during a run (Wake Lock). The 🔒 pocket lock blanks the screen and ignores stray touches: tap it to hear your pace, or hold it to unlock.
- **History** is stored on the device (IndexedDB) and shows splits, a route sketch and **GPX export** for Strava and similar apps.
- **Crash-safe.** The in-progress run is saved every 10 s and can be recovered on the next launch.
- km or miles, and it works offline.

## Android app (recommended)

The Android app is built with Capacitor from the same code. It keeps tracking and talking **with the screen locked**, lowers your music while it speaks, and shares GPX files through the normal share sheet.

**Install:**
1. Open the latest successful **Test & deploy** run under the repo's **Actions** tab.
2. Download the **mypacer-debug-apk** artifact. It's a zip; unzip it to get `app-debug.apk`.
3. Open the APK on your phone and allow installs from this source when asked.
4. On first Start, allow location (**Allow all the time** if offered) and notifications. The notification is what keeps GPS running while the phone is locked.
5. On Samsung, Xiaomi, Huawei and similar phones, turn off battery optimisation for MyPacer (Settings → Apps → MyPacer → Battery → Unrestricted). Otherwise the phone may stop the app mid-run.

To build it yourself: `npm run build:native`, then open `android/` in Android Studio, or run `cd android && ./gradlew assembleDebug`.

## Web app: keep it on screen

Browsers stop GPS for web apps when the screen locks or you switch apps, on both iOS and Android. MyPacer keeps the screen awake. Use the in-app 🔒 lock instead of your phone's lock button. If the app does go into the background, the missed section is filled with a straight line and you'll see a notice.

On iPhone: open the site in Safari, then Share → **Add to Home Screen**.

## Development

```sh
npm install
npm run dev        # http://localhost:5173/mypacer/
npm test           # unit tests (pace math, splits, auto-pause, announcer, GPX)
npm run build
```

**GPS simulator:** add `?sim` to the URL (for example `http://localhost:5173/mypacer/?sim=20#/`) to replay a fake run. The number speeds it up, so `?sim=20` runs 20× faster than real time. The route includes a warm-up, a traffic-light stop, a surge and a GPS glitch. Everything spoken is logged to `window.__spoken`.

Geolocation requires HTTPS, or `localhost`. To test on a phone, deploy to Pages or use a tunnel.

## Deploy

`.github/workflows/deploy.yml` tests, builds and publishes to GitHub Pages on every push to `main`. It also builds the debug APK on every push and PR. Enable it once under **Settings → Pages → Source: GitHub Actions**. The app is then served at `https://<user>.github.io/mypacer/`.

## Layout

- `src/core/`: pure logic, unit-tested (GPS filter, tracker, splits, auto-pause, announcer, GPX)
- `src/services/`: device APIs, using native plugins in the app and browser APIs on the web (location and simulator, speech, wake lock, IndexedDB, settings)
- `android/`: Capacitor Android project, including `AudioFocusPlugin.java`, which lowers music while MyPacer speaks
- `src/run/session.ts`: wires a run together
- `src/views`, `src/components`: Vue UI
