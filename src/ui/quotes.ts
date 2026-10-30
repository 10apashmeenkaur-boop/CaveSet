import type { IncidentCode } from '../sim/failures';

export type FailureCode = Extract<
  IncidentCode,
  | 'TOO_NARROW'
  | 'HEAD_ON_JAM'
  | 'SWING_BLOCK'
  | 'NO_PATH'
  | 'TIME_LIMIT'
  | 'DINING_DISTURBED'
  | 'QUEUE_OVERFLOW'
  | 'CROSS_FLOW'
  | 'UNDERUSED_HALL'
  | 'RAMP_TOO_STEEP'
  | 'TROLLEY_ROLLBACK'
  | 'NO_REST_LANDING'
  | 'TIGHT_TURN'
  | 'NO_ACCESSIBLE_ROUTE'
>;

/** What people say when a design fails them. Short, casual, under 8 words. Used for banners and speech bubbles. */
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
  DINING_DISTURBED: [
    'Bhaji, khaana kha rahe hain!',
    'Arre, not through the langar!',
    'Dhyan se, dal gir jayegi!',
    'Crate upar se? Seriously?',
  ],
  QUEUE_OVERFLOW: [
    'Andar aane ki jagah hi nahi!',
    'Line toh bahar tak hai!',
    'Joote utaarne mein itni der?',
    'Darwaze pe hi khade hain, ji.',
  ],
  CROSS_FLOW: [
    'Bhaji, bahar jaana hai!',
    'Andar wale, thoda ruko!',
    'Aana jaana ek hi raste?',
    'Side do ji, ghar jaana hai.',
  ],
  UNDERUSED_HALL: [
    'Hall khaali, line lambi!',
    'Pangat aadhi khaali hai!',
    'Sab log kahan reh gaye?',
    'Roti thandi ho rahi hai!',
  ],
  RAMP_TOO_STEEP: [
    'Bhaji, upar nahi chadh pa raha!',
    'Itni chadhai? Haath dukh gaye.',
    'Yeh ramp hai ya pahaad?',
  ],
  TROLLEY_ROLLBACK: [
    'Arre, trolley peeche ja rahi hai!',
    'Pakdo, pakdo! Phisal gayi!',
    'Bori wapas neeche aa gayi!',
  ],
  NO_REST_LANDING: [
    'Bas, saans phool gayi.',
    'Thoda rukne ki jagah toh do!',
    'Itna lamba ramp? Thak gaya.',
  ],
  TIGHT_TURN: [
    'Yahan mudun kaise, ji?',
    'Wheelchair ghoomegi nahi yahan!',
    'Jagah toh do mudne ki!',
  ],
  NO_ACCESSIBLE_ROUTE: [
    'Seedhiyan? Main kaise chadhun?',
    'Mere liye koi raasta nahi?',
    'Trolley seedhi pe? Na ji.',
  ],
};

/** Who says it, shown under banner quotes. */
export const FAILURE_LABEL: Record<FailureCode, string> = {
  TOO_NARROW: 'a sevadar, stuck at a narrow door',
  HEAD_ON_JAM: 'a sevadar, jammed in a doorway',
  SWING_BLOCK: 'a sevadar, hit by a swinging door',
  NO_PATH: 'a sevadar, lost, no way through',
  TIME_LIMIT: 'a sevadar, running late for langar',
  DINING_DISTURBED: 'a diner, trying to eat in peace',
  QUEUE_OVERFLOW: 'someone stuck at the entrance',
  CROSS_FLOW: 'a diner, trying to leave',
  UNDERUSED_HALL: 'a sevadar, serving an empty pangat',
  RAMP_TOO_STEEP: 'a wheelchair sevadar, at a steep ramp',
  TROLLEY_ROLLBACK: 'a sevadar, chasing a runaway trolley',
  NO_REST_LANDING: 'a wheelchair sevadar, halfway up',
  TIGHT_TURN: 'a wheelchair sevadar, stuck at a corner',
  NO_ACCESSIBLE_ROUTE: 'a wheelchair sevadar, at the foot of the stairs',
};

export type Quote = { text: string; code: FailureCode };

export function pickQuote(codes: FailureCode[] = Object.keys(QUOTES) as FailureCode[]): Quote {
  const code = codes[Math.floor(Math.random() * codes.length)];
  const list = QUOTES[code];
  return { code, text: list[Math.floor(Math.random() * list.length)] };
}

/** Stable quote for one speaker, so a bubble doesn't flicker between lines. */
export function quoteFor(code: IncidentCode, speaker: string): string | null {
  const list = QUOTES[code as FailureCode];
  if (!list) return null;
  let h = 0;
  for (const c of speaker) h = (h * 31 + c.charCodeAt(0)) | 0;
  return list[Math.abs(h) % list.length];
}
