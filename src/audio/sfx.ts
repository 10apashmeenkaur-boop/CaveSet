import { Howl, Howler } from 'howler';

/**
 * All game sounds, synthesised at startup into tiny WAVs (no audio files to ship) and played with howler.
 * Soft by design: sine tones, smooth attack and release (no clicks), low-ish pitch, short.
 * Always on at a fixed low volume; there are no sound controls.
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

/** Fade in over `attack` with a half-cosine, ring out exponentially, and fade the last 40 ms to exact silence. */
function envelope(t: number, len: number, attack: number, decay: number): number {
  if (t < 0 || t > len) return 0;
  const rise = t < attack ? 0.5 - 0.5 * Math.cos((Math.PI * t) / attack) : 1;
  const ring = t < attack ? 1 : Math.exp(-(t - attack) / decay);
  const tail = 0.04;
  const end = t > len - tail ? 0.5 + 0.5 * Math.cos((Math.PI * (t - (len - tail))) / tail) : 1;
  return rise * ring * end;
}

/**
 * One soft note gliding from f0 to f1 Hz over `len` s, with a little second harmonic for warmth.
 * Phase is integrated, so the glide is smooth.
 */
function note(f0: number, f1: number, len: number, attack: number, decay: number, warmth = 0.12, at = 0): Voice {
  return (time) => {
    const t = time - at;
    if (t < 0 || t > len) return 0;
    const phase = 2 * Math.PI * (f0 * t + ((f1 - f0) * t * t) / (2 * len));
    return 0.45 * envelope(t, len, attack, decay) * (Math.sin(phase) + warmth * Math.sin(2 * phase));
  };
}

const mix =
  (...voices: Voice[]): Voice =>
  (t) =>
    voices.reduce((sum, v) => sum + v(t), 0);

type Name = 'place' | 'erase' | 'creak' | 'chime' | 'oops';
/** The chosen soft set ("Soft wood"). */
const VOICES: Record<Name, [number, Voice]> = {
  place: [0.24, note(196, 180, 0.24, 0.008, 0.06, 0.2)],
  erase: [0.18, note(392, 330, 0.18, 0.012, 0.045)],
  creak: [0.3, note(147, 139, 0.3, 0.03, 0.1)],
  chime: [0.75, mix(note(523, 523, 0.5, 0.01, 0.2), note(659, 659, 0.6, 0.01, 0.22, 0.12, 0.14))],
  oops: [0.45, note(330, 247, 0.45, 0.02, 0.15)],
};

/** Fixed, quiet master volume (0..1). */
const VOLUME = 0.25;

let sounds: Record<Name, Howl> | null = null;

function load(): Record<Name, Howl> {
  if (!sounds) {
    sounds = {} as Record<Name, Howl>;
    for (const [name, [len, voice]] of Object.entries(VOICES) as [Name, [number, Voice]][]) {
      sounds[name] = new Howl({ src: [wav(len, voice)], format: ['wav'] });
    }
    Howler.volume(VOLUME);
  }
  return sounds;
}

const lastPlayed: Partial<Record<Name, number>> = {};

/** Play a one-shot sound. `minGapMs` stops rapid repeats (e.g. many doors creaking at once). */
export function sfx(name: Name, minGapMs = 0) {
  const now = performance.now();
  if (minGapMs && now - (lastPlayed[name] ?? -Infinity) < minGapMs) return;
  lastPlayed[name] = now;
  load()[name].play();
}
