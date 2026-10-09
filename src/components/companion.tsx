import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square, X } from "lucide-react";
import { FaceStage } from "@/components/living-face";
import { FACES, type FaceId } from "@/lib/faces";
import { LINES, PROMPTS, matchLine, speechLanguage, type Line, type LineId } from "@/lib/lines";
import { readSpeech, type FaceDrive, type Viseme } from "@/lib/speech-drive";
import { speakCaption } from "@/lib/voice-playback";

type Mode = "ready" | "listening" | "speaking";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<{ isFinal: boolean; 0?: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRec;
  webkitSpeechRecognition?: new () => SpeechRec;
};

const PERSONA_KEY = "matchapp-ai-persona";

const TONIGHT: { kicker: string; title: string; note: string; id: LineId }[] = [
  { kicker: "Warm", title: "The Intern", note: "Gentle, funny, easy to sink into", id: "feelgood" },
  { kicker: "Live", title: "A match on", note: "Stay with it while it happens", id: "sports" },
  { kicker: "Anime", title: "Spy x Family", note: "Bright, one perfect episode", id: "anime" },
  { kicker: "Where", title: "Name a title", note: "Points you to where it plays", id: "where" },
];

function FadingName({ name, live }: { name: string; live: boolean }) {
  const [shown, setShown] = useState(name);
  const [leaving, setLeaving] = useState<string | null>(null);
  const shownRef = useRef(name);
  const liveRef = useRef(false);

  useEffect(() => {
    if (!live) return;
    if (!liveRef.current) {
      liveRef.current = true;
      shownRef.current = name;
      setShown(name);
      setLeaving(null);
      return;
    }
    if (name === shownRef.current) return;
    const previous = shownRef.current;
    shownRef.current = name;
    setLeaving(previous);
    setShown(name);
  }, [live, name]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), 560);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return (
    <span className="brand-name">
      {leaving ? <strong className="is-leaving">{leaving}</strong> : null}
      <strong className={leaving ? "is-arriving" : ""}>{shown}</strong>
    </span>
  );
}

export function Companion() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const graphRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode } | null>(null);
  const driveRef = useRef<FaceDrive>({ speaker: null, env: 0, viseme: "rest" });
  const holdRef = useRef<{ viseme: Viseme; at: number }>({ viseme: "rest", at: 0 });
  const warmthRef = useRef(0);
  const timeRef = useRef<Uint8Array | null>(null);
  const freqRef = useRef<Uint8Array | null>(null);
  const pumpRef = useRef(0);
  const tokenRef = useRef(0);
  const wakeGen = useRef(0);
  const modeRef = useRef<Mode>("ready");
  const recRef = useRef<SpeechRec | null>(null);
  const whoRef = useRef<FaceId>("jonas");
  const awakeRef = useRef(false);
  const skipListenRef = useRef(false);
  const bubbleRef = useRef<HTMLButtonElement | null>(null);
  const tapLock = useRef(0);

  const [mode, setMode] = useState<Mode>("ready");
  const [who, setWho] = useState<FaceId>("jonas");
  const [speaker, setSpeaker] = useState<FaceId | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [draft, setDraft] = useState("");
  const [awake, setAwake] = useState(false);
  const [micNote, setMicNote] = useState("");
  const [heard, setHeard] = useState("");
  const [booted, setBooted] = useState(false);
  const [open, setOpen] = useState(false);
  const heardRef = useRef("");
  const answeredRef = useRef(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    whoRef.current = who;
  }, [who]);

  useEffect(() => {
    awakeRef.current = awake;
  }, [awake]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PERSONA_KEY);
      if (saved === "jonas") {
        whoRef.current = saved;
        setWho(saved);
      }
    } catch {
      /* private mode */
    }
    setBooted(true);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(pumpRef.current);
      audioRef.current?.pause();
      recRef.current?.stop();
      graphRef.current?.ctx.close().catch(() => {});
    };
  }, []);

  function setModeBoth(next: Mode) {
    modeRef.current = next;
    setMode(next);
  }

  function setAwakeBoth(next: boolean) {
    awakeRef.current = next;
    setAwake(next);
  }

  function pulse(pattern: number | number[]) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate?.(pattern);
  }

  function primeMic() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    const work = navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    void Promise.race([work, new Promise((resolve) => setTimeout(resolve, 1200))]).catch(() => {});
  }

  function ensureGraph() {
    const audio = audioRef.current;
    if (!audio) return null;
    if (graphRef.current) return graphRef.current;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.35;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      timeRef.current = new Uint8Array(analyser.fftSize);
      freqRef.current = new Uint8Array(analyser.frequencyBinCount);
      graphRef.current = { ctx, analyser };
      return graphRef.current;
    } catch {
      return null;
    }
  }

  function stopPump() {
    cancelAnimationFrame(pumpRef.current);
    driveRef.current = { speaker: null, env: 0, viseme: "rest" };
    bubbleRef.current?.style.setProperty("--env", "0");
  }

  function pump(token: number, persona: FaceId) {
    const graph = graphRef.current;
    const time = timeRef.current;
    const freq = freqRef.current;
    if (!graph || !time || !freq || token !== tokenRef.current) return;
    const read = readSpeech(graph.analyser, graph.ctx.sampleRate, time, freq, holdRef.current, performance.now());
    driveRef.current = { speaker: persona, env: read.env, viseme: read.viseme };
    bubbleRef.current?.style.setProperty("--env", read.env.toFixed(3));
    pumpRef.current = requestAnimationFrame(() => pump(token, persona));
  }

  function stop() {
    wakeGen.current += 1;
    tokenRef.current += 1;
    answeredRef.current = true;
    heardRef.current = "";
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    recRef.current?.stop();
    stopPump();
    setSpeaker(null);
    setModeBoth("ready");
    setHeard("");
    heardRef.current = "";
  }

  function waitUntilPlayable(audio: HTMLAudioElement) {
    if (audio.readyState >= 2) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        audio.removeEventListener("canplay", onReady);
        audio.removeEventListener("error", onBad);
        resolve(ok);
      };
      const onReady = () => done(true);
      const onBad = () => done(false);
      audio.addEventListener("canplay", onReady);
      audio.addEventListener("error", onBad);
      window.setTimeout(() => done(audio.readyState >= 2), 2500);
    });
  }

  function speak(persona: FaceId, id: LineId) {
    const audio = audioRef.current;
    if (!audio) return Promise.resolve();
    recRef.current?.stop();
    tokenRef.current += 1;
    const token = tokenRef.current;
    const next = LINES[persona][id];
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    stopPump();
    window.speechSynthesis?.cancel();
    setSpeaker(persona);
    setLine(next);
    setMicNote("");
    setHeard("");
    heardRef.current = "";
    setModeBoth("speaking");

    return new Promise<void>((resolve) => {
      const finish = () => {
        if (token !== tokenRef.current) return resolve();
        stopPump();
        setSpeaker(null);
        setModeBoth("ready");
        resolve();
      };
      const run = async () => {
        const graph = ensureGraph();
        if (graph && graph.ctx.state !== "running") {
          try {
            await graph.ctx.resume();
          } catch {
            /* clip can still play if the element was not captured */
          }
        }
        if (token !== tokenRef.current) return finish();
        audio.src = next.audio;
        audio.load();
        holdRef.current = { viseme: "rest", at: performance.now() };
        const ready = await waitUntilPlayable(audio);
        if (token !== tokenRef.current) return finish();
        if (ready) {
          try {
            await audio.play();
            if (token !== tokenRef.current) return finish();
            audio.onended = finish;
            audio.onerror = finish;
            pump(token, persona);
            return;
          } catch {
            /* fall through to the browser voice */
          }
        }
        if (token !== tokenRef.current) return finish();
        const lang = speechLanguage(navigator.language);
        pump(token, persona);
        await speakCaption(next.caption, persona, lang);
        finish();
      };
      void run().catch(() => finish());
    });
  }

  function commitHeard() {
    const said = heardRef.current.trim();
    if (answeredRef.current) return;
    answeredRef.current = true;
    if (!said) {
      if (modeRef.current === "listening") setModeBoth("ready");
      setMicNote("I didn’t catch that. Tap Listen, or type it below.");
      return;
    }
    setHeard("");
    setDraft("");
    setAwakeBoth(true);
    void speak(whoRef.current, matchLine(said));
  }

  function listen() {
    if (modeRef.current === "speaking") return;
    if (modeRef.current === "listening") {
      recRef.current?.stop();
      return;
    }
    const Ctor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Ctor) {
      setMicNote("The mic isn’t available in this browser. Type below and I’ll answer.");
      document.getElementById("ask")?.focus();
      return;
    }
    const rec = new Ctor();
    rec.lang = speechLanguage(navigator.language);
    rec.interimResults = true;
    rec.continuous = false;
    answeredRef.current = false;
    heardRef.current = "";
    setHeard("");
    rec.onresult = (ev) => {
      let text = "";
      let final = false;
      for (let i = 0; i < ev.results.length; i++) {
        const row = ev.results[i];
        text += row?.[0]?.transcript ?? "";
        if (row?.isFinal) final = true;
      }
      heardRef.current = text.trim();
      setHeard(heardRef.current);
      if (final) commitHeard();
    };
    rec.onerror = () => {
      if (heardRef.current || answeredRef.current) return;
      if (modeRef.current === "listening") setModeBoth("ready");
      setMicNote("I couldn’t hear the mic. Type below instead.");
    };
    rec.onend = () => {
      if (answeredRef.current) return;
      if (heardRef.current) {
        commitHeard();
        return;
      }
      if (modeRef.current === "listening") {
        setModeBoth("ready");
        setMicNote("I didn’t catch that. Tap Listen, or type it below.");
      }
    };
    recRef.current = rec;
    setModeBoth("listening");
    setMicNote("");
    pulse([10, 36, 12]);
    try {
      rec.start();
    } catch {
      setModeBoth("ready");
      setMicNote("Tap Listen again, or type below.");
    }
  }

  async function activate() {
    if (modeRef.current === "speaking") return;
    const gen = ++wakeGen.current;
    const persona = whoRef.current;
    setAwakeBoth(true);
    warmthRef.current = performance.now() + 2400;
    pulse(16);
    const spoken = speak(persona, "greet");
    primeMic();
    await spoken;
    if (gen !== wakeGen.current || skipListenRef.current) {
      skipListenRef.current = false;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 420));
    if (gen !== wakeGen.current || skipListenRef.current) {
      skipListenRef.current = false;
      return;
    }
    listen();
  }

  function takeTap() {
    const now = performance.now();
    if (now - tapLock.current < 650) return false;
    tapLock.current = now;
    return true;
  }

  function closeSheet() {
    setOpen(false);
    stop();
  }

  function onFace() {
    if (!takeTap()) return;
    if (!open) setOpen(true);
    if (modeRef.current === "speaking") return;
    if (!awakeRef.current) {
      void activate();
      return;
    }
    listen();
  }

  function onPrimary() {
    if (!takeTap()) return;
    if (!open) setOpen(true);
    if (modeRef.current === "speaking" || modeRef.current === "listening") {
      stop();
      return;
    }
    if (!awakeRef.current) {
      void activate();
      return;
    }
    listen();
  }

  function pick(next: FaceId) {
    if (next === whoRef.current) return;
    whoRef.current = next;
    setWho(next);
    try {
      localStorage.setItem(PERSONA_KEY, next);
    } catch {
      /* ignore */
    }
    if (modeRef.current !== "ready") stop();
    else wakeGen.current += 1;
    setLine(null);
    setMicNote("");
  }

  function playPrompt(id: LineId) {
    if (!takeTap()) return;
    setOpen(true);
    skipListenRef.current = true;
    wakeGen.current += 1;
    setAwakeBoth(true);
    void speak(whoRef.current, id);
  }

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setOpen(true);
    skipListenRef.current = true;
    wakeGen.current += 1;
    recRef.current?.stop();
    setAwakeBoth(true);
    setDraft("");
    void speak(whoRef.current, matchLine(trimmed));
  }

  function holdForTyping() {
    skipListenRef.current = true;
    if (modeRef.current === "listening") {
      wakeGen.current += 1;
      recRef.current?.stop();
      setModeBoth("ready");
    }
  }

  const face = FACES[who];
  const status =
    mode === "speaking" ? `${face.name} speaking` : mode === "listening" ? "Listening" : awake ? "With you" : "Waiting";
  const primaryLabel =
    mode === "speaking" ? "Stop" : mode === "listening" ? "Hearing you" : awake ? "Listen" : "Wake & listen";
  const bubbleClass = [
    "bubble",
    awake ? "is-awake" : "",
    mode === "speaking" ? "is-speaking" : "",
    mode === "listening" ? "is-listening" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="stage">
      <audio ref={audioRef} preload="none" playsInline />
      <div className="home">
        <header className="home-bar">
          <div className="brand">
            <small>
              <i className="diamond" />
              MatchApp
            </small>
            <strong>What to watch tonight</strong>
          </div>
          <span className={mode !== "ready" ? "status is-hot" : "status"}>
            <i />
            {status}
          </span>
        </header>

        <section className="hero">
          <p className="hero-kicker">Tonight</p>
          <h1>What should I watch?</h1>
          <p>{face.name} stays on this page. Tap the face, or pick a lane below.</p>
        </section>

        <section className="tonight" aria-label="Tonight">
          {TONIGHT.map((item) => (
            <button key={item.id} type="button" className="pick" onClick={() => playPrompt(item.id)}>
              <span className="pick-kicker">{item.kicker}</span>
              <strong>{item.title}</strong>
              <span>{item.note}</span>
            </button>
          ))}
        </section>
      </div>

      <button type="button" className={open ? "scrim is-on" : "scrim"} aria-label="Dismiss" tabIndex={open ? 0 : -1} onClick={closeSheet} />

      <div className={open ? "launcher is-open" : "launcher"}>
        <button type="button" className="dock-label" onClick={onFace} tabIndex={open ? -1 : 0}>
          Ask {face.name}
        </button>
        <div className="unravel">
          <button type="button" className="sheet-close" onClick={closeSheet} aria-label="Close" tabIndex={open ? 0 : -1}>
            <X size={18} />
          </button>
          <button
            ref={bubbleRef}
            type="button"
            className={bubbleClass}
           
            onClick={onFace}
            aria-pressed={awake}
            aria-label={open ? (awake ? `${face.name} is awake. Tap to listen.` : `Wake ${face.name}`) : `Open ${face.name}`}
          >
            <span className="aura" aria-hidden="true" />
            <span className="ripple" aria-hidden="true" />
            <span className="ripple" aria-hidden="true" />
            <span className="ripple" aria-hidden="true" />
            <span className="bubble-ring">
              <FaceStage id={who} booted={booted} driveRef={driveRef} warmthRef={warmthRef} />
            </span>
          </button>
          <div className="sheet-body">
            <header className="sheet-head">
              <div className="brand">
                <small>Companion</small>
                <FadingName name={face.name} live={booted} />
              </div>
            </header>
            {mode === "listening" || line ? (
              <p className={mode === "speaking" ? "said" : "said is-quiet"} aria-live="polite">
                <span className="caption-who">
                  {mode === "listening" ? (heard ? "You" : "Listening") : mode === "speaking" ? face.name : "Said"}
                </span>
                {mode === "listening" ? heard || "Go ahead. I’m listening." : line?.caption}
                {micNote ? <span className="mic-note">{micNote}</span> : null}
              </p>
            ) : (
              <p className="tap-hint">
                {awake
                  ? `${face.name} is with you. Tap the face to listen, or type below.`
                  : `Tap ${face.name}’s face. ${"He"}’ll say hello, then listen.`}
                {micNote ? <span className="mic-note">{micNote}</span> : null}
              </p>
            )}
            <button type="button" className={mode === "listening" ? "gold is-hear" : "gold"} onClick={onPrimary}>
              {mode === "speaking" ? <Square className="btn-ico" size={16} /> : <Mic className="btn-ico" size={18} />}
              {primaryLabel}
            </button>
            <div className="chips">
              {PROMPTS.map((prompt) => (
                <button key={prompt.id} type="button" className="chip" onClick={() => playPrompt(prompt.id)}>
                  {prompt.label}
                </button>
              ))}
            </div>
            <form
              className="ask"
              onSubmit={(event) => {
                event.preventDefault();
                ask(draft);
              }}
            >
              <input
                id="ask"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onFocus={holdForTyping}
                placeholder={mode === "listening" ? "Or type instead…" : `Ask ${face.name}…`}
                aria-label={`Ask ${face.name}`}
                autoComplete="off"
                suppressHydrationWarning
              />
              <button type="submit" className="send" aria-label="Send">
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
