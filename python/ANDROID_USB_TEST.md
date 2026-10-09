# MatchApp Ai — Jonas Android USB test

Development preview only. Not a Play Store release.

## Verified
- Python server serves the local preview and its assets.
- Seven Python chat API tests passed; TypeScript typecheck and tests passed.
- Debug Android APK builds and installs separately from production.
- Galaxy S23 Ultra: Home/Discover navigation, draggable persistent bubble, chat opening, and typed request submission work.
- No provider API key is present in the Python server environment. The API returns an explicit 503 configuration error.
- Android WebView lacks browser microphone transcription. A restricted native Android recognition bridge was built afterward but is not yet device-verified because USB disconnected.

## Run
1. On laptop: python app.py --port 8877 --no-browser
2. Connect and authorize the phone for ADB.
3. Run: adb reverse tcp:8877 tcp:8877
4. Install the debug APK separately (package com.jonas.papercup.debug).
5. Test-launch with: adb shell am start -n com.jonas.papercup.debug/com.jonas.papercup.MainActivity --es matchapp_smoke_url http://127.0.0.1:8877/

## Pending before production
- Configure an authenticated production AI endpoint and streaming catalog with quota checks.
- Set OPENROUTER_API_KEY or OPENAI_API_KEY in the server process environment; do not put credentials in JavaScript or APKs.
- Test microphone consent, native speech-to-text and text-to-speech on device.
- Build a standalone Android release linked to a hosted backend. The USB Python server is not a deployable production backend.
- Verify Play signing, privacy, subscriptions and release date after acceptance. Do not invent the launch date.

The AI context knows the creator was born October 10, 1986 and turns 40 on October 10, 2026.
