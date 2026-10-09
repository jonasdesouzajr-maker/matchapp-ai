export type VoicePersona = "jonas";

export function preferredVoice(persona: VoicePersona, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const male = /male|man|daniel|alex|fred|rishi|aaron|diego|ricardo/i;
  const want = male;
  void persona;
  const lang = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase();
  const pt = voices.filter((voice) => lang(voice).startsWith("pt"));
  const pool = pt.length ? pt : voices;
  return pool.find((voice) => want.test(`${voice.name} ${voice.voiceURI}`)) ?? pool[0] ?? null;
}

/** Speak a caption when the clip cannot play. Resolves when speech ends or is cancelled. */
export function speakCaption(caption: string, persona: VoicePersona, lang: string): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth || !caption.trim()) return Promise.resolve();
  synth.cancel();
  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(caption);
    utter.lang = lang;
    utter.rate = 0.96;
    utter.pitch = 0.9;
    const voice = preferredVoice(persona, synth.getVoices());
    if (voice) utter.voice = voice;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    utter.onend = finish;
    utter.onerror = finish;
    window.setTimeout(finish, Math.min(20000, 1200 + caption.length * 70));
    synth.speak(utter);
  });
}
