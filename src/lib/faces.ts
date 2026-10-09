export type FaceId = "jonas";
export type MouthShape = "aa" | "oh" | "ee";

export type Ellipse = { x: number; y: number; rx: number; ry: number };

export type FaceSpec = {
  id: FaceId;
  name: string;
  role: string;
  /** Normalized Y that should sit in the middle of the circle. */
  focus: number;
  /** Offsets blinks, breath, and smiles for natural movement. */
  phase: number;
  firstBlink: number;
  firstSmile: number;
  plates: {
    rest: string;
    blink: string;
    smile: string;
    aa: string;
    oh: string;
    ee: string;
  };
  eyes: [Ellipse, Ellipse];
  mouths: Record<MouthShape, Ellipse>;
  smile: Ellipse;
  /** Closed-lip seam. Speech opens this line instead of pasting another photo. */
  lip: { x: number; y: number; half: number };
};

export const FACES: Record<FaceId, FaceSpec> = {
  jonas: {
    id: "jonas",
    name: "Jonas",
    role: "Warm baritone",
    focus: 0.42,
    phase: 0,
    firstBlink: 1400,
    firstSmile: 2600,
    plates: {
      rest: "/faces/jonas/rest.jpg?v=board",
      blink: "/faces/jonas/blink.jpg?v=board",
      smile: "/faces/jonas/smile.jpg?v=board",
      aa: "/faces/jonas/aa.jpg?v=board",
      oh: "/faces/jonas/oh.jpg?v=board",
      ee: "/faces/jonas/ee.jpg?v=board",
    },
    eyes: [
      { x: 0.4, y: 0.35, rx: 0.07, ry: 0.02 },
      { x: 0.64, y: 0.35, rx: 0.066, ry: 0.02 },
    ],
    mouths: {
      aa: { x: 0.51, y: 0.57, rx: 0.078, ry: 0.02 },
      oh: { x: 0.51, y: 0.568, rx: 0.052, ry: 0.018 },
      ee: { x: 0.51, y: 0.568, rx: 0.09, ry: 0.014 },
    },
    smile: { x: 0.51, y: 0.556, rx: 0.1, ry: 0.024 },
    lip: { x: 0.508, y: 0.557, half: 0.095 },
  }
};
