import tomatoManifest from "../../assets/voice/xiami/tomato-egg/v1/manifest.json";
import garlicManifest from "../../assets/voice/xiami/garlic-lettuce/v1/manifest.json";
import sharedManifest from "../../assets/voice/xiami/shared/v1/manifest.json";
import type { GarlicLettuceVoiceLineId } from "@/lib/garlic-lettuce-dialogue";
import { speakRecipeText, stopRecipeSpeech } from "@/lib/recipe-speech";

export type XiamiVoiceLineId =
  | "phase-prep"
  | "phase-heat"
  | "phase-egg"
  | "phase-tomato"
  | "phase-finish"
  | "outcome-burnt-egg"
  | "outcome-burnt-tomato"
  | "outcome-raw-egg"
  | "outcome-raw-tomato"
  | "outcome-salty"
  | "outcome-bland"
  | "outcome-perfect";

export interface XiamiVoiceLine {
  id: string;
  kind: "phase" | "outcome";
  text: string;
  file: string;
  durationMs: number;
  src: string;
}

interface RawVoiceManifest {
  basePath: string;
  lines: Omit<XiamiVoiceLine, "src">[];
}

export type XiamiPlaybackResult =
  | "playing"
  | "fallback"
  | "blocked"
  | "cancelled";

interface PlaybackOptions {
  onFallback?: () => void;
}

function hydrateManifest(manifest: RawVoiceManifest) {
  return manifest.lines.map((line) => ({
    ...line,
    src: `${manifest.basePath}${line.file}`,
  }));
}

const tomatoVoiceManifest = tomatoManifest as RawVoiceManifest;
const garlicVoiceManifest = garlicManifest as RawVoiceManifest;
const xiamiSharedVoiceManifest = sharedManifest as RawVoiceManifest;

export const XIAMI_VOICE_LINES = hydrateManifest(tomatoVoiceManifest);
export const GARLIC_VOICE_LINES = hydrateManifest(garlicVoiceManifest);
export const XIAMI_SHARED_VOICE_LINES = hydrateManifest(
  xiamiSharedVoiceManifest,
);

const tomatoLineMap = new Map(
  XIAMI_VOICE_LINES.map((line) => [line.id, line]),
);
const garlicLineMap = new Map(
  GARLIC_VOICE_LINES.map((line) => [line.id, line]),
);
const sharedLineMap = new Map(
  XIAMI_SHARED_VOICE_LINES.map((line) => [line.id, line]),
);
const audioCache = new Map<string, HTMLAudioElement>();
let activeAudio: HTMLAudioElement | null = null;
let playbackGeneration = 0;

export function getXiamiVoiceLine(id: XiamiVoiceLineId) {
  const line = tomatoLineMap.get(id);
  if (!line) {
    throw new Error(`Unknown Xiami voice line: ${id}`);
  }
  return line;
}

export function getGarlicLettuceVoiceLine(
  id: GarlicLettuceVoiceLineId,
) {
  const line = garlicLineMap.get(id);
  if (!line) {
    throw new Error(`Unknown garlic lettuce voice line: ${id}`);
  }
  return line;
}

export function getLowScoreDejectedVoiceLine() {
  const line = sharedLineMap.get("low-score-dejected");
  if (!line) {
    throw new Error("Unknown shared Xiami voice line: low-score-dejected");
  }
  return line;
}

export function xiamiVoiceSrc(line: XiamiVoiceLine) {
  return line.src;
}

function audioFor(line: XiamiVoiceLine) {
  const cached = audioCache.get(line.id);
  if (cached) return cached;

  const audio = new Audio(xiamiVoiceSrc(line));
  audio.preload = "auto";
  audioCache.set(line.id, audio);
  return audio;
}

export function preloadXiamiVoice(lines = XIAMI_VOICE_LINES) {
  for (const line of lines) {
    // Creating the media element with preload="auto" starts fetching without
    // issuing a second load() that can abort an already-pending play().
    audioFor(line);
  }
}

export function stopXiamiVoice() {
  playbackGeneration += 1;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  stopRecipeSpeech();
}

export async function playXiamiVoice(
  line: XiamiVoiceLine,
  options: PlaybackOptions = {},
): Promise<XiamiPlaybackResult> {
  stopXiamiVoice();
  const generation = playbackGeneration;
  const audio = audioFor(line);
  activeAudio = audio;

  audio.addEventListener(
    "ended",
    () => {
      if (activeAudio === audio) activeAudio = null;
    },
    { once: true },
  );

  try {
    await audio.play();
    return generation === playbackGeneration ? "playing" : "cancelled";
  } catch (error) {
    if (generation !== playbackGeneration) return "cancelled";
    activeAudio = null;

    if (
      error instanceof DOMException &&
      error.name === "NotAllowedError"
    ) {
      return "blocked";
    }

    speakRecipeText(line.text, { rate: 1.04, pitch: 1.12 });
    options.onFallback?.();
    return "fallback";
  }
}
