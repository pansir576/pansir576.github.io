type SoundType = "water" | "cut" | "sizzle-start" | "sizzle-stop";

let context: AudioContext | null = null;
let sizzleSource: AudioBufferSourceNode | null = null;
let sizzleGain: GainNode | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return null;
  context ??= new AudioContextClass();
  if (context.state === "suspended") void context.resume();
  return context;
}

function noiseBuffer(ctx: AudioContext, seconds = 1): AudioBuffer {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frames; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function oneShotNoise(
  ctx: AudioContext,
  type: "water" | "cut",
): void {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noiseBuffer(ctx, type === "water" ? 0.45 : 0.12);
  filter.type = type === "water" ? "highpass" : "bandpass";
  filter.frequency.value = type === "water" ? 900 : 1800;
  filter.Q.value = type === "water" ? 0.5 : 1.8;
  gain.gain.setValueAtTime(type === "water" ? 0.12 : 0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + (type === "water" ? 0.45 : 0.12));
}

export function playKitchenSound(type: SoundType): void {
  const ctx = audioContext();
  if (!ctx) return;
  if (type === "water" || type === "cut") {
    oneShotNoise(ctx, type);
    return;
  }
  if (type === "sizzle-stop") {
    sizzleGain?.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + 0.15,
    );
    try {
      sizzleSource?.stop(ctx.currentTime + 0.16);
    } catch {
      // The source may already have stopped.
    }
    sizzleSource = null;
    sizzleGain = null;
    return;
  }
  if (sizzleSource) return;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noiseBuffer(ctx, 2);
  source.loop = true;
  filter.type = "bandpass";
  filter.frequency.value = 2300;
  filter.Q.value = 0.65;
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.3);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  sizzleSource = source;
  sizzleGain = gain;
}
