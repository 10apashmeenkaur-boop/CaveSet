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
  | 'NO_HANDRAIL'
  | 'TIGHT_TURN'
  | 'NO_ACCESSIBLE_ROUTE'
>;

/** What people say when a design fails them. Short (under 8 words), plain, polite English. Used for banners and speech bubbles. */
export const QUOTES: Record<FailureCode, string[]> = {
  TOO_NARROW: [
    'This crate will not fit through.',
    'This door is too narrow.',
    'Who designed this doorway?',
    'My crate is stuck. Please help.',
  ],
  HEAD_ON_JAM: [
    'Please move, I am carrying this.',
    'After you. No, after you.',
    'Could you step aside, please?',
    'We cannot both fit through.',
  ],
  SWING_BLOCK: [
    'Ouch, the door hit me.',
    'Please open the door.',
    'The door will not open.',
    'Someone is behind the door.',
  ],
  NO_PATH: [
    'Where am I supposed to go?',
    'Which way is it?',
    'There are walls everywhere.',
    'There is no way through.',
  ],
  TIME_LIMIT: [
    'The meal is running late.',
    'Please hurry, people are waiting.',
    'The dishes are still dirty.',
    'Why is this route so long?',
  ],
  DINING_DISTURBED: [
    'Excuse me, we are eating.',
    'Please do not walk through here.',
    'Careful, you will spill the food.',
    'A crate over our plates?',
  ],
  QUEUE_OVERFLOW: [
    'There is no room to come in.',
    'The line reaches the street.',
    'Why is the shoe stand so slow?',
    'We are stuck at the door.',
  ],
  CROSS_FLOW: [
    'Excuse me, I need to leave.',
    'Please wait, I am coming out.',
    'One path for in and out?',
    'Let me through, please.',
  ],
  UNDERUSED_HALL: [
    'The hall is empty, the line long.',
    'Half the seats are empty.',
    'Where is everyone?',
    'The food is getting cold.',
  ],
  RAMP_TOO_STEEP: [
    'I cannot get up this slope.',
    'This ramp is far too steep.',
    'Is this a ramp or a hill?',
  ],
  TROLLEY_ROLLBACK: [
    'The trolley is rolling back!',
    'Hold it, it is slipping!',
    'The sacks rolled back down.',
  ],
  NO_HANDRAIL: [
    'I need something to hold on to.',
    'Is there no handrail here?',
    'Where is the railing?',
  ],
  TIGHT_TURN: [
    'How am I meant to turn?',
    'My wheelchair cannot turn here.',
    'I need room to turn.',
  ],
  NO_ACCESSIBLE_ROUTE: [
    'Stairs? How do I get up?',
    'Is there no way up for me?',
    'A trolley cannot take stairs.',
  ],
};

/** Who says it, shown under banner quotes. */
export const FAILURE_LABEL: Record<FailureCode, string> = {
  TOO_NARROW: 'a volunteer, stuck at a narrow door',
  HEAD_ON_JAM: 'a volunteer, jammed in a doorway',
  SWING_BLOCK: 'a volunteer, hit by a swinging door',
  NO_PATH: 'a volunteer, lost, no way through',
  TIME_LIMIT: 'a volunteer, running late for the meal',
  DINING_DISTURBED: 'a diner, trying to eat in peace',
  QUEUE_OVERFLOW: 'someone stuck at the entrance',
  CROSS_FLOW: 'a diner, trying to leave',
  UNDERUSED_HALL: 'a volunteer, beside a half-empty hall',
  RAMP_TOO_STEEP: 'a wheelchair user, at a steep ramp',
  TROLLEY_ROLLBACK: 'a volunteer, chasing a runaway trolley',
  NO_HANDRAIL: 'an elderly visitor, halfway up the ramp',
  TIGHT_TURN: 'a wheelchair user, stuck at a corner',
  NO_ACCESSIBLE_ROUTE: 'a wheelchair user, at the foot of the stairs',
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
