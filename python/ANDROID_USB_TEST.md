# MatchApp Ai — Jonas Android USB test

Development preview only. Not a Play Store release.

## Verified
- Local Python server serves the Jonas companion UI and assets.
- All seven Python API contract tests pass. TypeScript typecheck and existing repository tests passed.
- Android V45 debug APK builds, verifies its signature, and installs separately from the production app.
- Galaxy S23 Ultra: Home/Discover navigation, persistent draggable bubble, chat opening, and typed requests were exercised.
- A one-time Android microphone permission prompt appeared; native recognition started, and the no-speech fallback returned control without a crash. Actual spoken-word transcription and speech output are not yet verified.
- Four browser regression runs passed at 390, 412, 768 and 1365 CSS pixels without detected horizontal overflow or JavaScript errors. Navigation, dragging, chat and error response checks all passed.
- The local Python server is not configured with an AI provider key; the app shows an informative offline message instead of fabricated answers.

## Run the USB preview
1. On the laptop, launch python app.py --port 8877 --no-browser from the python directory.
2. Connect and authorize the Galaxy phone for ADB.
3. Execute: adb reverse tcp:8877 tcp:8877
4. Install the APK in Downloads (debug package com.jonas.papercup.debug).
5. Execute: adb shell am start -n com.jonas.papercup.debug/com.jonas.papercup.MainActivity --es matchapp_smoke_url http://127.0.0.1:8877/

The Downloads directory also contains Install-MatchApp-Ai-Jonas-USB-Test.bat, which performs the USB setup and launches the debug app.

## Blockers before production
- Connect the new interface to the existing JWT-protected Supabase gemini-proxy using authenticated user sessions and credit/quota enforcement. Never bypass the existing authentication checks or embed secret keys in the APK.
- Connect the full MatchApp Ai catalog and verify country-specific streaming results.
- Verify genuine spoken-word recognition, native text-to-speech, accessibility and device coverage.
- Deploy a secure hosted backend and build an independent signed release APK/AAB. The localhost Python server is a test scaffold only.
- Complete privacy, billing, Play Store listing, release-signing, and staged rollout reviews.

Jonas knows that his creator was born on October 10, 1986 and turns 40 on October 10, 2026. The official Play Store launch date must be recorded only when verified; none has been invented.

## Reinstallation QA (9 October 2026)
- Reinstalled signed v45 (1.1.41-debug) on a Samsung Galaxy S23 Ultra and verified launcher-icon startup into the Python preview over USB reverse on 8877.
- Android WebView native regression: 8 checks passed, 0 failed, 0 uncaught page errors; verified navigation, persistent draggable bubble, chat, clear offline message, native voice bridge callbacks.
- Responsive regression: all 4 test widths passed (390/412/768/1365); Python API contract suite: 7/7 passed.
- The old styles.css 404 was removed from HTML and all referenced local assets checked successfully.
- Live model replies, streaming accuracy and spoken transcription have NOT passed end-to-end due to missing preview-provider credentials/production auth connection.
- TTS callback events indicate speech started and finished, but acoustic audibility/voice quality were not verified.
- This APK still requires a running laptop server and ADB reverse; it is NOT an independent production app.
