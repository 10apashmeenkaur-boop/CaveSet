export type FailureCode = 'TOO_NARROW' | 'HEAD_ON_JAM' | 'SWING_BLOCK' | 'NO_PATH' | 'TIME_LIMIT';

/** What sevadars say when a design fails them. Short, casual, under 8 words. Reused for speech bubbles in M5. */
export const QUOTES: Record<FailureCode, string[]> = {
  TOO_NARROW: [
    'Bhaji, crate nahi ja raha!',
    'Arre, door is too small!',
    'Who made this door?!',
    'Crate phas gaya, help!',
  ],
  HEAD_ON_JAM: [
    'Move na, I’m carrying this!',
    'Pehle aap… no, pehle aap!',
    'Side do, bhaji!',
    'Both of us can’t fit!',
  ],
  SWING_BLOCK: [
    'Ouch, the door hit me.',
    'Darwaza khol na, yaar!',
    'Hato, door won’t open!',
    'Someone’s behind the door!',
  ],
  NO_PATH: [
    'Where do I even go?',
    'Rasta kidhar hai?',
    'Wall hi wall hai!',
    'No way out, ji.',
  ],
  TIME_LIMIT: [
    'Langar is getting late!',
    'Jaldi karo, sangat is waiting!',
    'Bartan abhi tak dirty hain!',
    'Itna lamba route? Why?',
  ],
};

/** Short label for who says it, shown under banner quotes. */
export const FAILURE_LABEL: Record<FailureCode, string> = {
  TOO_NARROW: 'stuck at a narrow door',
  HEAD_ON_JAM: 'jammed in a doorway',
  SWING_BLOCK: 'hit by a swinging door',
  NO_PATH: 'lost, no way through',
  TIME_LIMIT: 'running late for langar',
};

export type Quote = { text: string; code: FailureCode };

export function pickQuote(codes: FailureCode[] = Object.keys(QUOTES) as FailureCode[]): Quote {
  const code = codes[Math.floor(Math.random() * codes.length)];
  const list = QUOTES[code];
  return { code, text: list[Math.floor(Math.random() * list.length)] };
}
