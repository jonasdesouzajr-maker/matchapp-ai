const LINES = {
  jonas: {
    greet: ["Hello, I'm Jonas, your brand new AI here on MatchApp. What can I help you with today?", "voice/jonas/greet.mp3"],
    feelgood: ["If you want something warm, try The Intern. Gentle, funny, and easy to sink into.", "voice/jonas/feelgood.mp3"],
    sports: ["For something live, put a match on. I'll stay with you while you watch.", "voice/jonas/sports.mp3"],
    anime: ["If you want anime, start with Spy x Family. Bright, funny, one perfect episode.", "voice/jonas/anime.mp3"],
    where: ["Tell me the title, and I'll point you to where it plays.", "voice/jonas/where.mp3"],
    fallback: ["Give me a mood, a platform, or a title, and I'll point you somewhere worth pressing play.", "voice/jonas/fallback.mp3"]
  },
  aureya: {
    greet: ["Hello, I'm Aureya, your brand new AI here on MatchApp. What can I help you with today?", "voice/aureya/greet.mp3"],
    feelgood: ["If you want something tender, try Past Lives. Quiet, glowing, and it stays with you.", "voice/aureya/feelgood.mp3"],
    sports: ["If the room wants energy, put a live match on. I'll keep the moments close.", "voice/aureya/sports.mp3"],
    anime: ["For anime tonight, try Frieren. Slow, kind, and beautiful to sit with.", "voice/aureya/anime.mp3"],
    where: ["Name the title. I'll tell you which service actually has it.", "voice/aureya/where.mp3"],
    fallback: ["I'm here. A mood, a platform, or a title is enough.", "voice/aureya/fallback.mp3"]
  }
};
const ROLES = { jonas: ["Jonas", "Warm baritone", "He"], aureya: ["Aureya", "Soft alto", "She"] };
const stage = document.getElementById("stage");
const audio = document.getElementById("voice");
const plates = [...document.querySelectorAll(".plate")];
let who = localStorage.getItem("matchapp-ai-persona") || "jonas";
if (!LINES[who]) who = "jonas";
let mode = "ready";
let awake = false;
let token = 0;
let rec = null;
let graph = null;
let pump = 0;
let blinkAt = performance.now() + 1400;

function speechLanguage() {
  const lang = (navigator.language || "en-US").toLowerCase();
  if (lang.startsWith("pt")) return "pt-BR";
  if (lang.startsWith("es")) return "es-ES";
  return navigator.language || "en-US";
}
function matchLine(input) {
  const q = input.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
  if (!q) return "fallback";
  if (/anime|manga|ghibli|frieren|spy x/.test(q)) return "anime";
  if (/\b(sport|sports|futebol|football|soccer|jogo|partida)\b|\b(live|ao vivo)\b/.test(q)) return "sports";
  if (/\b(where|onde)\b|netflix|streaming|assistir|onde passa/.test(q)) return "where";
  if (/\b(warm|cozy|comedy|funny|gentle|comfort|quente|aconchegante|comedia|leve)\b/.test(q)) return "feelgood";
  if (/^(hi|hello|hey|oi|ola|bom dia|boa noite)[!.?,\s]*$/.test(q) || (/\b(who are you|quem e voce)\b/.test(q) && q.length < 48)) return "greet";
  return "fallback";
}
function paint(next) {
  plates.forEach((img) => img.classList.toggle("is-on", img.dataset.shape === next));
}
function setPlates() {
  plates.forEach((img) => { img.src = `faces/${who}/${img.dataset.shape}.jpg`; });
  paint("rest");
}
function render() {
  const [name, role, pronoun] = ROLES[who];
  document.getElementById("name").textContent = name;
  document.getElementById("role").textContent = role;
  document.getElementById("lead").textContent = awake
    ? `${name} is forward. Tap Listen, or type below.`
    : `Tap the face. ${pronoun} comes off the screen, says hello, then waits.`;
  document.getElementById("draft").placeholder = `Ask ${name}…`;
  document.getElementById("pick-jonas").classList.toggle("is-picked", who === "jonas");
  document.getElementById("pick-aureya").classList.toggle("is-picked", who === "aureya");
  document.getElementById("status").textContent = mode === "speaking" ? `${name} speaking` : mode === "listening" ? "Listening" : awake ? "With you" : "Waiting";
  document.getElementById("primary").textContent = mode === "listening" ? "Hearing you" : awake ? "Listen" : "Wake";
  stage.classList.toggle("is-awake", awake);
  stage.classList.toggle("is-speaking", mode === "speaking");
  stage.classList.toggle("is-listening", mode === "listening");
  stage.classList.toggle("is-hot", mode !== "ready");
}
function show(caption, label, note) {
  document.getElementById("who-said").textContent = label;
  document.getElementById("caption").textContent = caption;
  document.getElementById("note").textContent = note || "";
}
function setMode(next) { mode = next; render(); }
function ensureGraph() {
  if (graph) return graph;
  try {
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    graph = { ctx, analyser, time: new Uint8Array(analyser.fftSize) };
  } catch { graph = null; }
  return graph;
}
function stopPump() { cancelAnimationFrame(pump); paint("rest"); }
function drive() {
  if (!graph || mode !== "speaking") return;
  graph.analyser.getByteTimeDomainData(graph.time);
  let sum = 0;
  for (const v of graph.time) { const n = (v - 128) / 128; sum += n * n; }
  const env = Math.sqrt(sum / graph.time.length);
  paint(env < 0.04 ? "rest" : env > 0.12 ? "aa" : env > 0.07 ? "oh" : "ee");
  pump = requestAnimationFrame(drive);
}
function speakCaption(caption) {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve();
  synth.cancel();
  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(caption);
    utter.lang = speechLanguage();
    utter.pitch = who === "aureya" ? 1.12 : 0.9;
    utter.onend = resolve;
    utter.onerror = resolve;
    setTimeout(resolve, 1200 + caption.length * 70);
    synth.speak(utter);
  });
}
async function speak(id) {
  const mine = ++token;
  const [caption, src] = LINES[who][id];
  rec?.stop();
  window.speechSynthesis?.cancel();
  audio.pause();
  stopPump();
  awake = true;
  setMode("speaking");
  show(caption, ROLES[who][0], "");
  const g = ensureGraph();
  if (g && g.ctx.state !== "running") await g.ctx.resume().catch(() => {});
  if (mine !== token) return;
  audio.src = src;
  audio.load();
  const ready = await new Promise((resolve) => {
    audio.addEventListener("canplay", () => resolve(true), { once: true });
    audio.addEventListener("error", () => resolve(false), { once: true });
    setTimeout(() => resolve(audio.readyState >= 2), 2500);
  });
  if (mine !== token) return;
  try {
    if (!ready) throw new Error("clip");
    await audio.play();
    drive();
    await new Promise((resolve) => { audio.onended = resolve; audio.onerror = resolve; });
  } catch {
    paint("aa");
    await speakCaption(caption);
  }
  if (mine !== token) return;
  stopPump();
  setMode("ready");
  show(caption, ROLES[who][0], "Tap Listen when you want to answer.");
}
function listen() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) {
    show(document.getElementById("caption").textContent, ROLES[who][0], "Mic isn't available. Type below.");
    document.getElementById("draft").focus();
    return;
  }
  rec?.stop();
  rec = new Ctor();
  rec.lang = speechLanguage();
  rec.interimResults = true;
  rec.continuous = false;
  let heard = "";
  rec.onresult = (ev) => {
    heard = [...ev.results].map((row) => row[0]?.transcript || "").join(" ").trim();
    show(heard || "Go ahead.", "You", "");
    if ([...ev.results].some((row) => row.isFinal)) speak(matchLine(heard));
  };
  rec.onerror = () => { if (!heard) { setMode("ready"); show("I couldn't hear the mic.", ROLES[who][0], "Type below instead."); } };
  rec.onend = () => { if (mode === "listening" && heard) speak(matchLine(heard)); else if (mode === "listening") setMode("ready"); };
  setMode("listening");
  show("Go ahead. I'm listening.", "You", "");
  try { rec.start(); } catch { setMode("ready"); }
}
function stop() {
  token += 1;
  audio.pause();
  rec?.stop();
  window.speechSynthesis?.cancel();
  stopPump();
  setMode("ready");
}
function pick(next) {
  if (next === who) return;
  who = next;
  localStorage.setItem("matchapp-ai-persona", who);
  stop();
  setPlates();
  show("Waiting on this side of the screen.", ROLES[who][0], "");
  render();
}
function tick(now) {
  if (mode !== "speaking" && now > blinkAt) {
    paint("blink");
    setTimeout(() => { if (mode !== "speaking") paint("rest"); }, 140);
    blinkAt = now + 2600 + Math.random() * 2800;
  }
  requestAnimationFrame(tick);
}
document.getElementById("face").onclick = () => { if (mode === "speaking") return; awake ? listen() : speak("greet"); };
document.getElementById("primary").onclick = () => { if (mode === "listening") return stop(); if (!awake) return speak("greet"); listen(); };
document.getElementById("stop").onclick = stop;
document.getElementById("pick-jonas").onclick = () => pick("jonas");
document.getElementById("pick-aureya").onclick = () => pick("aureya");
document.querySelectorAll("[data-line]").forEach((btn) => { btn.onclick = () => speak(btn.dataset.line); });
document.getElementById("ask").onsubmit = (event) => {
  event.preventDefault();
  const text = document.getElementById("draft").value.trim();
  if (!text) return;
  document.getElementById("draft").value = "";
  speak(matchLine(text));
};
setPlates();
render();
requestAnimationFrame(tick);
