# Handoff for the next agent

This folder is the local MatchApp AI companion. Jonas and Aureya, their face plates, and their voice clips. Standard-library Python only. Do not add a framework.

## Run

```bash
python app.py
```

Windows: `run.bat`. Serves `web/` at http://127.0.0.1:8765/.

## Keep

- Palette: plum `#100814` / `#14081c`, gold `#e6c36a`.
- Faces in `web/faces/{jonas,aureya}/` (`rest`, `blink`, `smile`, `aa`, `oh`, `ee`).
- Clips in `web/voice/{jonas,aureya}/`. Play the clip first. If `play()` fails, speak the caption.
- Start audio only inside a click. Do not call `SpeechRecognition.start()` after an `await`.
- Mic language: `pt-BR` when the browser is Portuguese, otherwise the browser language.
- The TypeScript app in the repo root is the deployed companion. This folder is the laptop build. Do not delete `src/` to "clean up".

## Next

Wire answers to the MatchApp catalog instead of the six canned lines. Leave the face and voice path alone unless a clip 404s.
