import { Howl, Howler } from 'howler';

/**
 * All game sounds, synthesised at startup into tiny WAVs (no audio files to ship) and played with howler.
 * Soft by design: sine tones, smooth attack and release (no clicks), low-ish pitch, short.
 * Sound is OFF by default; on/off, volume and the chosen sound set are remembered per browser.
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
type SoundSet = { name: string; voices: Record<Name, [number, Voice]> };

/** Three soft sets to choose from (temporary "Sound test" on level select). */
export const SOUND_SETS: SoundSet[] = [
  {
    name: 'Soft wood',
    voices: {
      place: [0.24, note(196, 180, 0.24, 0.008, 0.06, 0.2)],
      erase: [0.18, note(392, 330, 0.18, 0.012, 0.045)],
      creak: [0.3, note(147, 139, 0.3, 0.03, 0.1)],
      chime: [0.75, mix(note(523, 523, 0.5, 0.01, 0.2), note(659, 659, 0.6, 0.01, 0.22, 0.12, 0.14))],
      oops: [0.45, note(330, 247, 0.45, 0.02, 0.15)],
    },
  },
  {
    name: 'Bubbles',
    voices: {
      place: [0.2, note(262, 175, 0.2, 0.006, 0.05, 0)],
      erase: [0.16, note(330, 440, 0.16, 0.01, 0.04, 0)],
      creak: [0.28, note(165, 175, 0.28, 0.04, 0.09, 0.05)],
      chime: [0.7, mix(note(392, 392, 0.4, 0.01, 0.15, 0), note(494, 494, 0.4, 0.01, 0.15, 0, 0.1), note(587, 587, 0.45, 0.01, 0.18, 0, 0.2))],
      oops: [0.4, note(262, 196, 0.4, 0.02, 0.14, 0)],
    },
  },
  {
    name: 'Felt pad',
    voices: {
      place: [0.3, note(131, 123, 0.3, 0.02, 0.09, 0.25)],
      erase: [0.22, note(262, 220, 0.22, 0.02, 0.06, 0.15)],
      creak: [0.36, note(110, 104, 0.36, 0.05, 0.12, 0.15)],
      chime: [0.85, mix(note(440, 440, 0.6, 0.03, 0.28, 0.15), note(554, 554, 0.65, 0.03, 0.3, 0.15, 0.18))],
      oops: [0.5, note(220, 165, 0.5, 0.04, 0.18, 0.2)],
    },
  },
];

const MUTE_KEY = 'design-lab.muted';
const VOLUME_KEY = 'design-lab.volume';
const SET_KEY = 'design-lab.soundSet';
export const DEFAULT_VOLUME = 0.4;

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // not persisted; fine
  }
};

let sounds: Record<Name, Howl> | null = null;

function load(): Record<Name, Howl> {
  if (!sounds) {
    const set = SOUND_SETS[getSoundSet()];
    sounds = {} as Record<Name, Howl>;
    for (const [name, [len, voice]] of Object.entries(set.voices) as [Name, [number, Voice]][]) {
      sounds[name] = new Howl({ src: [wav(len, voice)], format: ['wav'] });
    }
    Howler.mute(isMuted());
    Howler.volume(getVolume());
  }
  return sounds;
}

export function isMuted(): boolean {
  return read(MUTE_KEY) !== '0';
}

export function setMuted(muted: boolean) {
  write(MUTE_KEY, muted ? '1' : '0');
  Howler.mute(muted);
}

/** 0..1, default 40%. */
export function getVolume(): number {
  const v = Number(read(VOLUME_KEY));
  return read(VOLUME_KEY) !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
}

export function setVolume(v: number) {
  write(VOLUME_KEY, String(v));
  Howler.volume(v);
}

export function getSoundSet(): number {
  const i = Number(read(SET_KEY));
  return Number.isInteger(i) && i >= 0 && i < SOUND_SETS.length ? i : 0;
}

export function setSoundSet(i: number) {
  write(SET_KEY, String(i));
  if (sounds) for (const h of Object.values(sounds)) h.unload();
  sounds = null;
}

const lastPlayed: Partial<Record<Name, number>> = {};

/** Play a one-shot sound. `minGapMs` stops rapid repeats (e.g. many doors creaking at once). */
export function sfx(name: Name, minGapMs = 0) {
  const now = performance.now();
  if (minGapMs && now - (lastPlayed[name] ?? -Infinity) < minGapMs) return;
  lastPlayed[name] = now;
  load()[name].play();
}

/** Sound test: every sound of the current set, one after another. */
export function playDemo() {
  (['place', 'erase', 'creak', 'chime', 'oops'] as Name[]).forEach((name, i) => setTimeout(() => sfx(name), i * 700));
}
