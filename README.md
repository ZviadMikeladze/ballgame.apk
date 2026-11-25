# Ricochet Foundry

Multi-level physics ball arcade game built with React, TypeScript, Tailwind CSS, HTML5 Canvas, and Capacitor for Android.

## Local Development

```bash
npm install
npm run dev
```

## Automatic Android APK Build (GitHub Actions)

Every push to `main` (or manual trigger from the **Actions** tab) runs `.github/workflows/build-apk.yml`:

1. Builds the web bundle (`npm run build`).
2. Initializes and syncs the Capacitor Android project (`npx cap add android && npx cap sync android`).
3. Compiles `app-debug.apk` with Gradle and uploads it as a workflow artifact named **`ricochet-foundry-debug-apk`**.

To download the APK on GitHub:
1. Open your repository on GitHub and click the **Actions** tab.
2. Select the latest **Build Android APK** workflow run.
3. Scroll down to **Artifacts** and download **`ricochet-foundry-debug-apk`**.

## Local Android Studio / Google Play Release (`.aab`)

```bash
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio, use **Build → Generate Signed Bundle / APK → Android App Bundle** to create a signed `.aab` for Google Play Console.
