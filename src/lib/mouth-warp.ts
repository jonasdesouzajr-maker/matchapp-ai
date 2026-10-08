import type { FaceSpec } from "@/lib/faces";
import type { Viseme } from "@/lib/speech-drive";

export type MouthPose = {
  /** Mouth opening, fraction of image height. */
  open: number;
  /** Corner lift, fraction of image height. */
  corner: number;
  teeth: number;
  power: number;
  /** Upper-lip lift, fraction of image height. */
  lift: number;
};

export const MOUTH_POSES: Record<Viseme | "smile", MouthPose> = {
  rest: { open: 0, corner: 0, teeth: 0, power: 1.6, lift: 0 },
  smile: { open: 0, corner: 0.0065, teeth: 0, power: 1.5, lift: 0 },
  ee: { open: 0.007, corner: 0.0055, teeth: 0.45, power: 1.45, lift: 0.0012 },
  oh: { open: 0.013, corner: 0.001, teeth: 0.08, power: 2.3, lift: 0.002 },
  aa: { open: 0.018, corner: 0.0015, teeth: 0.85, power: 1.65, lift: 0.0022 },
};

export type MouthRig = {
  x0: number;
  y0: number;
  w: number;
  h: number;
  cx: number;
  part: number;
  half: number;
  lipKeep: number;
  imgH: number;
};

export function mouthRig(width: number, height: number, spec: FaceSpec): MouthRig {
  const cx = spec.lip.x * width;
  const part = spec.lip.y * height;
  const half = spec.lip.half * width;
  const y0 = Math.max(2, Math.floor(part - 0.045 * height));
  const y1 = Math.min(height - 3, Math.floor(part + 0.1 * height));
  const x0 = Math.max(2, Math.floor(cx - half * 1.5));
  const x1 = Math.min(width - 3, Math.ceil(cx + half * 1.5));
  return {
    x0,
    y0,
    w: Math.max(1, x1 - x0),
    h: Math.max(1, y1 - y0),
    cx,
    part,
    half,
    lipKeep: 0.034 * height,
    imgH: height,
  };
}

export function lerpPose(a: MouthPose, b: MouthPose, t: number): MouthPose {
  return {
    open: a.open + (b.open - a.open) * t,
    corner: a.corner + (b.corner - a.corner) * t,
    teeth: a.teeth + (b.teeth - a.teeth) * t,
    power: a.power + (b.power - a.power) * t,
    lift: a.lift + (b.lift - a.lift) * t,
  };
}

export function scalePose(pose: MouthPose, amount: number): MouthPose {
  return {
    ...pose,
    open: pose.open * amount,
    corner: pose.corner * amount,
    teeth: pose.teeth * amount,
    lift: pose.lift * amount,
  };
}

function sample(src: Uint8ClampedArray, rw: number, lx: number, y: number, top: number, bot: number) {
  const yy = Math.min(bot - 1.001, Math.max(top, y));
  const i = Math.floor(yy);
  const f = yy - i;
  const o0 = ((i - top) * rw + lx) * 4;
  const o1 = ((i + 1 - top) * rw + lx) * 4;
  return [
    src[o0] * (1 - f) + src[o1] * f,
    src[o0 + 1] * (1 - f) + src[o1 + 1] * f,
    src[o0 + 2] * (1 - f) + src[o1 + 2] * f,
  ];
}

/** Opens the closed mouth on `dest`, using `src` (a tight rect of the rest plate). */
export function warpMouth(src: ImageData, rig: MouthRig, pose: MouthPose, dest: Uint8ClampedArray) {
  const data = src.data;
  dest.set(data);
  const { x0, y0, w, h, cx, part, half, lipKeep, imgH } = rig;
  const top = y0;
  const bot = y0 + h - 1;
  const gap0 = pose.open * imgH;
  const corner = pose.corner * imgH;
  const lift0 = pose.lift * imgH;
  const teeth = pose.teeth;
  const power = pose.power;
  if (gap0 < 0.4 && corner < 0.4 && lift0 < 0.3) return;

  for (let x = 0; x < w; x++) {
    const n = (x + x0 - cx) / half;
    if (n <= -1 || n >= 1) continue;
    const hx = (1 - n * n) ** power;
    if (hx < 0.02) continue;
    const local = part - corner * Math.abs(n) ** 1.2;
    const gap = gap0 * hx;
    const lift = lift0 * hx;
    const upperEnd = local - lift;
    const cavityEnd = local + gap;
    const lipEnd = cavityEnd + lipKeep;
    if (lipEnd >= bot - 2 || upperEnd <= top + 2) continue;

    const srcUpper = local - top;
    const dstUpper = Math.max(1, upperEnd - top);
    const srcTail = bot - (local + lipKeep);
    const dstTail = Math.max(1, bot - lipEnd);

    for (let y = top; y <= bot; y++) {
      let r: number;
      let g: number;
      let b: number;
      if (y < upperEnd) {
        const sy = top + ((y - top) * srcUpper) / dstUpper;
        [r, g, b] = sample(data, w, x, sy, top, bot);
      } else if (y < cavityEnd) {
        const t = (y - upperEnd) / Math.max(1, cavityEnd - upperEnd);
        const shade = t * t;
        r = 48 * (1 - shade) + 132 * shade * 0.75;
        g = 18 * (1 - shade) + 64 * shade * 0.75;
        b = 16 * (1 - shade) + 62 * shade * 0.75;
        if (teeth > 0 && t < 0.55) {
          const tw = Math.max(0, 1 - (Math.abs(n) * 1.15) ** 2);
          const tt = t / 0.55;
          let amt = teeth * tw * (1 - tt * 0.35);
          if (t < 0.08) amt *= t / 0.08;
          r = r * (1 - amt) + (198 * (1 - tt) + 150 * tt) * amt;
          g = g * (1 - amt) + (176 * (1 - tt) + 112 * tt) * amt;
          b = b * (1 - amt) + (156 * (1 - tt) + 102 * tt) * amt;
        }
        if (t < 0.1) {
          const s = 0.55 + 4.5 * t;
          r *= s;
          g *= s;
          b *= s;
        }
        const side = 0.35 + 0.65 * hx;
        r *= side;
        g *= side;
        b *= side;
      } else if (y < lipEnd) {
        [r, g, b] = sample(data, w, x, local + (y - cavityEnd), top, bot);
      } else {
        const sy = local + lipKeep + ((y - lipEnd) * srcTail) / dstTail;
        [r, g, b] = sample(data, w, x, sy, top, bot);
      }

      let edge = Math.min(1, hx / 0.18);
      const vy = Math.min(y - top, bot - y) / (0.01 * imgH);
      edge *= Math.max(0, Math.min(1, vy));
      const o = ((y - top) * w + x) * 4;
      dest[o] = data[o] * (1 - edge) + r * edge;
      dest[o + 1] = data[o + 1] * (1 - edge) + g * edge;
      dest[o + 2] = data[o + 2] * (1 - edge) + b * edge;
    }
  }
}
