import { Howl, Howler } from 'howler';

/**
 * All game sounds, synthesised at startup into tiny WAVs (no audio files to ship) and played with howler.
 * Sound is OFF by default; the choice is remembered per browser.
 */

const RATE = 22050;
type Voice = (t: number) => number;

function wav(seconds: number, voice: Voice): string {
  const n = Math.floor(seconds * RATE);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, voice(i / RATE)));
    v.setInt16(44 + i * 2, s * 0x7fff, true);
  }
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

// Deterministic noise so sounds are identical every load.
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const env = (t: number, attack: number, decay: number) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));
const sin = (f: number, t: number) => Math.sin(2 * Math.PI * f * t);

const VOICES = {
  /** Brick/door dropped into place: low thump with a little grit. */
  place: [0.25, (t: number) => env(t, 0.004, 0.06) * (0.9 * sin(90 - 120 * t, t) + 0.25 * noise())],
  /** Eraser: a quick upward pop. */
  erase: [0.14, (t: number) => env(t, 0.002, 0.03) * sin(500 + 2200 * t, t) * 0.7],
  /** Hinged door: a short wooden creak. */
  creak: [0.4, (t: number) => env(t, 0.03, 0.15) * 0.35 * Math.sign(sin(140 + 60 * Math.sin(t * 25), t)) * (0.6 + 0.4 * noise())],
  /** Run finished well: two bright notes. */
  chime: [0.9, (t: number) => 0.4 * (env(t, 0.005, 0.25) * sin(880, t) + (t > 0.15 ? env(t - 0.15, 0.005, 0.35) * sin(1318.5, t) : 0))],
  /** Run failed: a falling "oops". */
  oops: [0.6, (t: number) => env(t, 0.01, 0.2) * 0.45 * sin(420 - 260 * t, t)],
} as const;

type Name = keyof typeof VOICES;
const MUTE_KEY = 'design-lab.muted';
let sounds: Partial<Record<Name, Howl>> | null = null;

function load(): Record<Name, Howl> {
  if (!sounds) {
    sounds = {};
    for (const [name, [len, voice]] of Object.entries(VOICES) as [Name, readonly [number, Voice]][]) {
      sounds[name] = new Howl({ src: [wav(len, voice)], format: ['wav'], volume: 0.6 });
    }
    Howler.mute(isMuted());
  }
  return sounds as Record<Name, Howl>;
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // not persisted; fine
  }
  Howler.mute(muted);
}

const lastPlayed: Partial<Record<Name, number>> = {};

/** Play a one-shot sound. `minGapMs` stops rapid repeats (e.g. many doors creaking at once). */
export function sfx(name: Name, minGapMs = 0) {
  const now = performance.now();
  if (minGapMs && now - (lastPlayed[name] ?? -Infinity) < minGapMs) return;
  lastPlayed[name] = now;
  load()[name].play();
}
