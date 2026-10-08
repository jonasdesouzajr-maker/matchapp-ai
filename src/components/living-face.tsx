import { useEffect, useRef, useState } from "react";
import { FACES, type Ellipse, type FaceId, type FaceSpec } from "@/lib/faces";
import { lerpPose, MOUTH_POSES, mouthRig, scalePose, warpMouth, type MouthPose } from "@/lib/mouth-warp";
import type { FaceDrive, Viseme } from "@/lib/speech-drive";

const OFF_W = 576;
const OFF_H = 864;

type BlinkState = { next: number; start: number; double: boolean };
type SmileState = { next: number; start: number };

function makeMask(ellipses: Ellipse[], blur: number) {
  const canvas = document.createElement("canvas");
  canvas.width = OFF_W;
  canvas.height = OFF_H;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  g.filter = `blur(${blur}px)`;
  g.fillStyle = "#fff";
  for (const e of ellipses) {
    g.beginPath();
    g.ellipse(e.x * OFF_W, e.y * OFF_H, e.rx * OFF_W, e.ry * OFF_H, 0, 0, Math.PI * 2);
    g.fill();
  }
  return canvas;
}

function mouthPose(shown: Viseme, prev: Viseme, mix: number, env: number, smileAmt: number): MouthPose {
  const speaking = shown !== "rest" || prev !== "rest";
  if (!speaking) {
    return { ...MOUTH_POSES.smile, corner: MOUTH_POSES.smile.corner * smileAmt };
  }
  const gate = Math.min(1, 0.55 + env * 0.75);
  const pose = scalePose(lerpPose(MOUTH_POSES[prev], MOUTH_POSES[shown], mix), gate);
  pose.corner += MOUTH_POSES.smile.corner * smileAmt * 0.35;
  return pose;
}
function blit(
  main: CanvasRenderingContext2D,
  scratch: CanvasRenderingContext2D,
  scratchCanvas: HTMLCanvasElement,
  img: HTMLImageElement,
  mask: HTMLCanvasElement,
  alpha: number,
) {
  if (alpha < 0.02) return;
  scratch.clearRect(0, 0, OFF_W, OFF_H);
  scratch.globalCompositeOperation = "source-over";
  scratch.globalAlpha = 1;
  scratch.drawImage(img, 0, 0, OFF_W, OFF_H);
  scratch.globalCompositeOperation = "destination-in";
  scratch.drawImage(mask, 0, 0);
  scratch.globalCompositeOperation = "source-over";
  main.save();
  main.globalAlpha = Math.min(1, alpha);
  main.drawImage(scratchCanvas, 0, 0);
  main.restore();
}

export function LivingFace({
  id,
  driveRef,
  warmthRef,
}: {
  id: FaceId;
  driveRef: { current: FaceDrive };
  warmthRef?: { current: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const view = canvas.getContext("2d");
    if (!view) return;
    canvas.classList.remove("is-on");
    const spec = FACES[id];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let frame = 0;

    const off = document.createElement("canvas");
    off.width = OFF_W;
    off.height = OFF_H;
    const g = off.getContext("2d");
    const scratchCanvas = document.createElement("canvas");
    scratchCanvas.width = OFF_W;
    scratchCanvas.height = OFF_H;
    const scratch = scratchCanvas.getContext("2d");
    if (!g || !scratch) return;

    const eyeMask = makeMask(spec.eyes, 6);

    const base = document.createElement("canvas");
    base.width = OFF_W;
    base.height = OFF_H;
    const baseCtx = base.getContext("2d", { willReadFrequently: true });
    const work = document.createElement("canvas");
    work.width = OFF_W;
    work.height = OFF_H;
    const workCtx = work.getContext("2d");
    if (!baseCtx || !workCtx) return;

    const rig = mouthRig(OFF_W, OFF_H, spec);
    let mouthSrc: ImageData | null = null;
    let mouthFrame: ImageData | null = null;

    const blink: BlinkState = { next: -1, start: -1, double: false };
    const smile: SmileState = { next: -1, start: -1 };
    let env = 0;
    let shown: Viseme = "rest";
    let prev: Viseme = "rest";
    let mix = 1;
    let last = performance.now();

    const paint = (images: Partial<Record<keyof FaceSpec["plates"], HTMLImageElement>>, t: number) => {
      const rest = images.rest;
      if (!rest) return;
      if (blink.next < 0) blink.next = t + spec.firstBlink;
      if (smile.next < 0) smile.next = t + spec.firstSmile;
      const dt = Math.min(40, t - last);
      last = t;
      const drive = driveRef.current;
      const target = drive.speaker === id ? drive.env : 0;
      env += (target - env) * (target > env ? 0.62 : 0.2);

      const incoming: Viseme = drive.speaker === id ? drive.viseme : "rest";
      if (incoming !== shown) {
        prev = shown;
        shown = incoming;
        mix = 0;
      }
      mix = Math.min(1, mix + dt / 70);

      let blinkAmt = 0;
      if (!reduced) {
        if (blink.start < 0 && t >= blink.next) {
          blink.start = t;
          blink.double = Math.random() < 0.22;
          blink.next = t + 2600 + Math.random() * 3400;
        }
        if (blink.start >= 0) {
          const elapsed = t - blink.start;
          const dur = 150;
          if (elapsed < dur) blinkAmt = Math.sin((Math.PI * elapsed) / dur);
          else if (blink.double && elapsed > 130 && elapsed < 130 + dur) {
            blinkAmt = Math.sin((Math.PI * (elapsed - 130)) / dur) * 0.9;
          } else if (elapsed > dur + 200) blink.start = -1;
        }
      }

      let smileAmt = 0;
      if (!reduced && env < 0.12) {
        if (warmthRef && t < warmthRef.current) {
          const left = warmthRef.current - t;
          const amp = left > 480 ? 1 : Math.max(0, left / 480);
          smileAmt = Math.max(smileAmt, 0.92 * amp);
        }
        if (smile.start < 0 && t >= smile.next) {
          smile.start = t;
          smile.next = t + 6800 + Math.random() * 5200;
        }
        if (smile.start >= 0) {
          const e = t - smile.start;
          if (e < 420) smileAmt = Math.max(smileAmt, e / 420);
          else if (e < 1280) smileAmt = Math.max(smileAmt, 1);
          else if (e < 1760) smileAmt = Math.max(smileAmt, 1 - (e - 1280) / 480);
          else smile.start = -1;
        }
      }

      const breath = reduced ? 0 : Math.sin((t + spec.phase) * 0.00148);
      const sway = reduced ? 0 : Math.sin((t + spec.phase) * 0.00038);
      const nod = env * Math.sin(t * 0.014) * 2.2;

      if (!mouthSrc) {
        baseCtx.drawImage(rest, 0, 0, OFF_W, OFF_H);
        mouthSrc = baseCtx.getImageData(rig.x0, rig.y0, rig.w, rig.h);
        mouthFrame = new ImageData(rig.w, rig.h);
      }

      const pose = reduced ? MOUTH_POSES.rest : mouthPose(shown, prev, mix, env, smileAmt);
      workCtx.setTransform(1, 0, 0, 1, 0, 0);
      workCtx.clearRect(0, 0, OFF_W, OFF_H);
      workCtx.drawImage(base, 0, 0);
      if (mouthSrc && mouthFrame && (pose.open > 0.001 || pose.corner > 0.0008)) {
        warpMouth(mouthSrc, rig, pose, mouthFrame.data);
        workCtx.putImageData(mouthFrame, rig.x0, rig.y0);
      }
      if (images.blink) blit(workCtx, scratch, scratchCanvas, images.blink, eyeMask, blinkAmt);

      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, OFF_W, OFF_H);
      g.save();
      g.translate(OFF_W / 2, OFF_H * 0.74);
      g.rotate(sway * 0.012);
      g.scale(1 + breath * 0.007, 1 + breath * 0.011);
      g.translate(-OFF_W / 2 + sway * 4, -OFF_H * 0.74 - breath * 7 - nod);
      g.drawImage(work, 0, 0);
      g.restore();

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const css = canvas.clientWidth || 240;
      const size = Math.max(2, Math.round(css * dpr));
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      const side = OFF_W;
      const sy = Math.max(0, Math.min(OFF_H - side, spec.focus * OFF_H - side / 2));
      view.clearRect(0, 0, size, size);
      view.save();
      view.beginPath();
      view.arc(size / 2, size / 2, size / 2 - 0.5, 0, Math.PI * 2);
      view.clip();
      view.imageSmoothingEnabled = true;
      view.imageSmoothingQuality = "high";
      view.drawImage(off, 0, sy, side, side, 0, 0, size, size);
      view.restore();
      canvas.classList.add("is-on");
    };

    const images: Partial<Record<keyof FaceSpec["plates"], HTMLImageElement>> = {};
    let started = false;
    const start = () => {
      if (started || cancelled || !images.rest) return;
      started = true;
      const loop = (t: number) => {
        paint(images, t);
        if (!reduced) frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    };
    for (const key of ["rest", "blink"] as const) {
      const src = spec.plates[key];
      const plate = new Image();
      plate.decoding = "async";
      plate.onload = () => {
        if (cancelled) return;
        images[key] = plate;
        if (key === "rest") start();
      };
      plate.src = src;
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [driveRef, id, warmthRef]);

  const spec = FACES[id];
  return (
    <span className="living-face" style={{ ["--still-y" as string]: `${(spec.focus * 3 - 1) * 100}%` }}>
      <img className="living-still" src={spec.plates.rest} alt="" />
      <canvas ref={canvasRef} className="living-live" />
    </span>
  );
}

type Slot = { id: FaceId; token: number; leaving: boolean; settled: boolean; enter: boolean };

export function FaceStage({
  id,
  booted,
  driveRef,
  warmthRef,
}: {
  id: FaceId;
  booted: boolean;
  driveRef: { current: FaceDrive };
  warmthRef?: { current: number };
}) {
  const [slots, setSlots] = useState<Slot[]>([{ id, token: 0, leaving: false, settled: true, enter: false }]);
  const seenBoot = useRef(false);
  const tokenRef = useRef(1);

  useEffect(() => {
    for (const face of Object.values(FACES)) {
      const rest = new Image();
      rest.src = face.plates.rest;
      const blink = new Image();
      blink.src = face.plates.blink;
    }
  }, []);

  useEffect(() => {
    if (!booted) return;
    if (!seenBoot.current) {
      seenBoot.current = true;
      setSlots((prev) => (prev.length === 1 && prev[0]?.id === id ? prev : [{ id, token: tokenRef.current, leaving: false, settled: true, enter: false }]));
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setSlots((prev) => {
      const top = [...prev].reverse().find((slot) => !slot.leaving) ?? prev[prev.length - 1];
      if (!top || top.id === id) return prev;
      const nextToken = ++tokenRef.current;
      if (reduced) return [{ id, token: nextToken, leaving: false, settled: true, enter: false }];
      return [
        { ...top, leaving: true, settled: true, enter: false },
        { id, token: nextToken, leaving: false, settled: true, enter: true },
      ];
    });
    if (reduced) return;
  }, [booted, id]);

  useEffect(() => {
    if (!slots.some((slot) => slot.leaving)) return;
    const done = window.setTimeout(() => {
      setSlots((prev) => prev.filter((slot) => !slot.leaving));
    }, 880);
    return () => window.clearTimeout(done);
  }, [slots]);

  return (
    <span className="face-stage">
      {slots.map((slot) => (
        <span
          key={slot.token}
          className={["face-layer", slot.settled ? "is-settled" : "", slot.enter ? "is-in" : "", slot.leaving ? "is-out" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <LivingFace id={slot.id} driveRef={driveRef} warmthRef={warmthRef} />
        </span>
      ))}
    </span>
  );
}
