import type { MouthShape } from "@/lib/faces";

export type Viseme = "rest" | MouthShape;

export type FaceDrive = {
  speaker: "jonas" | "aureya" | null;
  env: number;
  viseme: Viseme;
};

export function readSpeech(
  analyser: AnalyserNode,
  sampleRate: number,
  time: Uint8Array,
  freq: Uint8Array,
  hold: { viseme: Viseme; at: number },
  now: number,
): { env: number; viseme: Viseme } {
  analyser.getByteTimeDomainData(time as Uint8Array<ArrayBuffer>);
  analyser.getByteFrequencyData(freq as Uint8Array<ArrayBuffer>);

  let sum = 0;
  for (let i = 0; i < time.length; i++) {
    const v = (time[i] - 128) / 128;
    sum += v * v;
  }
  const env = Math.min(1, Math.sqrt(sum / time.length) * 8);

  const fft = analyser.fftSize;
  const band = (lo: number, hi: number) => {
    const hz = sampleRate / fft;
    const i0 = Math.max(1, Math.floor(lo / hz));
    const i1 = Math.min(freq.length - 1, Math.ceil(hi / hz));
    let s = 0;
    let c = 0;
    for (let i = i0; i <= i1; i++) {
      s += freq[i];
      c += 1;
    }
    return c ? s / c / 255 : 0;
  };

  const low = band(140, 520);
  const mid = band(520, 1500);
  const high = band(1500, 4200);

  let next: Viseme = "rest";
  if (env > 0.06) {
    if (high > low * 1.25 && high > mid) next = "ee";
    else if (mid > low * 1.15 && mid > high) next = "oh";
    else next = "aa";
  }

  const since = now - hold.at;
  if (next !== "rest") {
    const switchingShape = hold.viseme !== "rest" && next !== hold.viseme;
    if (!switchingShape || since > 140) {
      if (next !== hold.viseme) hold.at = now;
      hold.viseme = next;
    }
  } else if (hold.viseme !== "rest" && since > 160) {
    hold.viseme = "rest";
    hold.at = now;
  }

  return { env, viseme: hold.viseme };
}
