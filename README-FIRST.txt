THE FICTIONAL ARCHIVE - ANDROID APK BUILD PACKAGE

This package is prepared to build an Android APK in the cloud. It is not itself an APK.
The build workflow creates the APK for you, so you do not need Android Studio.

ONE-TIME SETUP
1. On your phone, open https://github.com and sign in or create a free account.
2. Create a new repository. Name it fictional-archive. Set it to Private if you prefer.
3. Upload the contents of this ZIP into that repository (upload the files and folders, not the ZIP itself).
4. Open the repository's Actions tab.
5. Select "Build Android APK" and tap "Run workflow".
6. Wait for the run to finish, then open the completed run.
7. Under Artifacts, download "fictional-archive-debug-apk".
8. Extract the downloaded ZIP and tap app-debug.apk on your Android phone to install it.
   Android may ask you to allow installs from your browser or file manager. Only enable this
   for the app you used to download/open the APK, then turn it off again afterward.

IMPORTANT
- This is a personal debug APK, not a Play Store release.
- The APK is unsigned for Play Store publishing but can be installed manually on your own device.
- Keep the GitHub repository private if you do not want the source code public.
- The app stores its archive in local browser/WebView storage on that device. Export backups
  from inside the app regularly; uninstalling the app may remove its local data.
- The source uses React and Capacitor. The cloud workflow builds the Android wrapper for you.

If the Actions tab is missing, open the repository's Settings > Actions and enable actions.
