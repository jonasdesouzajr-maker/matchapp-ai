import type { FaceId } from "@/lib/faces";

export type LineId = "greet" | "feelgood" | "sports" | "anime" | "where" | "fallback";

export type Line = {
  id: LineId;
  audio: string;
  caption: string;
};

const jonas: Record<LineId, Line> = {
  greet: {
    id: "greet",
    audio: "/voice/jonas/greet.mp3?v=hello",
    caption: "Hello, I'm Jonas, your brand new AI here on MatchApp. What can I help you with today?",
  },
  feelgood: {
    id: "feelgood",
    audio: "/voice/jonas/feelgood.mp3",
    caption: "If you want something warm, try The Intern. Gentle, funny, and easy to sink into.",
  },
  sports: {
    id: "sports",
    audio: "/voice/jonas/sports.mp3",
    caption: "For something live, put a match on. I’ll stay with you while you watch.",
  },
  anime: {
    id: "anime",
    audio: "/voice/jonas/anime.mp3",
    caption: "If you want anime, start with Spy x Family. Bright, funny, one perfect episode.",
  },
  where: {
    id: "where",
    audio: "/voice/jonas/where.mp3",
    caption: "Tell me the title, and I’ll point you to where it plays.",
  },
  fallback: {
    id: "fallback",
    audio: "/voice/jonas/fallback.mp3",
    caption: "Give me a mood, a platform, or a title, and I’ll point you somewhere worth pressing play.",
  },
};

const aureya: Record<LineId, Line> = {
  greet: {
    id: "greet",
    audio: "/voice/aureya/greet.mp3?v=hello",
    caption: "Hello, I'm Aureya, your brand new AI here on MatchApp. What can I help you with today?",
  },
  feelgood: {
    id: "feelgood",
    audio: "/voice/aureya/feelgood.mp3",
    caption: "If you want something tender, try Past Lives. Quiet, glowing, and it stays with you.",
  },
  sports: {
    id: "sports",
    audio: "/voice/aureya/sports.mp3",
    caption: "If the room wants energy, put a live match on. I’ll keep the moments close.",
  },
  anime: {
    id: "anime",
    audio: "/voice/aureya/anime.mp3",
    caption: "For anime tonight, try Frieren. Slow, kind, and beautiful to sit with.",
  },
  where: {
    id: "where",
    audio: "/voice/aureya/where.mp3",
    caption: "Name the title. I’ll tell you which service actually has it.",
  },
  fallback: {
    id: "fallback",
    audio: "/voice/aureya/fallback.mp3",
    caption: "I’m here. A mood, a platform, or a title is enough.",
  },
};

export const LINES: Record<FaceId, Record<LineId, Line>> = { jonas, aureya };

export const PROMPTS: { label: string; id: LineId }[] = [
  { label: "Something warm", id: "feelgood" },
  { label: "Something live", id: "sports" },
  { label: "Anime tonight", id: "anime" },
  { label: "Where to watch", id: "where" },
];

export function matchLine(input: string): LineId {
  const q = input.toLowerCase().trim();
  if (!q) return "fallback";
  if (/anime|manga|ghibli|frieren|spy x/.test(q)) return "anime";
  if (/\b(sport|sports|futebol|football|soccer)\b|\blive\b/.test(q)) return "sports";
  if (/\bwhere\b|which (app|service|platform)|netflix|streaming/.test(q)) return "where";
  if (/\b(warm|cozy|feel-good|feel good|comedy|funny|gentle|comfort)\b/.test(q)) return "feelgood";
  if (/^(hi|hello|hey|oi|who are you)[!.?\s]*$/.test(q)) return "greet";
  return "fallback";
}
