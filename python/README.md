# MatchApp Ai — Jonas Python companion

Jonas is the sole avatar. The local prototype uses Python's standard-library HTTP server, while the immersive visual experience is HTML/CSS/JavaScript.

## Local preview

Run `python app.py --port 8877 --no-browser` from this folder, or use `Run-MatchApp-Ai-Preview.bat` for port 8899. Open the address printed by Python. No pip packages are required.

A `.preview.local.json` file is loaded locally if present and is **ignored by Git**. The only supported value for the existing Supabase integration is `MATCHAPP_SUPABASE_ANON_KEY`, the **public legacy anon JWT**, which is intentionally not committed. Provider API keys must stay server-side. The local Python backend forwards `mode: "discover"` requests to the existing metered `gemini-proxy` function, preserving its quota and model fallback system. Without a configured backend, the UI shows an explicit temporary service-unavailable message.

## Standalone Android QA

The separate Android preview build packages the contents of `web/` into native assets. Its Android-only `MatchAppNativeAI` bridge calls the existing Supabase AI proxy directly, rather than requiring Python to run on the user's phone or laptop. The native `MatchAppNativeVoice` bridge handles speech recognition and text-to-speech.

The standalone QA Android branch lives in `jonasdesouzajr-maker/matchapp.tv` at `test/android-jonas-standalone-preview-20261009`. It uses a separate `.preview` application ID and **development signing only**; it must not be uploaded to the existing production listing.

## Motion and identity

Both portrait and persistent bubble use double-buffered facial frame crossfades. Small idle and 3D-styled effects respect reduced-motion preferences. Jonas's symbolic birthday is October 10; the creator's birthday is October 10, 1986. The official public Play launch date is **unverified** and should only be recorded when the real release is published.

## Release blockers

The standalone QA interface is **not the complete existing MatchApp Ai production website**. It still needs production account identity, subscriptions/credit enforcement, full catalog and country-specific verified streaming, policy/consent and accessibility checks, and authorized Play upload signing before it can replace production. Keep adult and Kids Mode behavior isolated. Do not ship any localhost URL.
