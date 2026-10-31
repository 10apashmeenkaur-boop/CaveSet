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

/** What people say when a design fails them: short (under 8 words), practical, about the problem. Used for banners and speech bubbles. */
export const QUOTES: Record<FailureCode, string[]> = {
  TOO_NARROW: [
    'This crate won’t fit.',
    'This door is too narrow.',
    'My crate is stuck in the door.',
    'I need a wider door.',
  ],
  HEAD_ON_JAM: [
    'Please move, I’m carrying this.',
    'We can’t both fit through.',
    'Please step aside.',
    'Let me pass first, please.',
  ],
  SWING_BLOCK: [
    'The door is blocked.',
    'The door won’t open.',
    'Someone is behind the door.',
    'Please move, the door can’t open.',
  ],
  NO_PATH: [
    'There’s no way through.',
    'Which way do I go?',
    'There are walls everywhere.',
    'I can’t reach the other side.',
  ],
  TIME_LIMIT: [
    'We’re running late.',
    'This route is too long.',
    'Too much waiting here.',
    'People are waiting for this.',
  ],
  DINING_DISTURBED: [
    'Excuse me, we’re eating here.',
    'Please don’t walk through here.',
    'Careful, you’ll spill the food.',
    'Please go around the hall.',
  ],
  QUEUE_OVERFLOW: [
    'There’s no room to come in.',
    'The line is out the door.',
    'The shoe stand is too slow.',
    'We’re stuck at the entrance.',
  ],
  CROSS_FLOW: [
    'Excuse me, I need to get out.',
    'Please wait, I’m coming out.',
    'In and out share one path.',
    'Let me through, please.',
  ],
  UNDERUSED_HALL: [
    'Half the seats are empty.',
    'The line is too slow.',
    'We’re still waiting to sit.',
    'The food is getting cold.',
  ],
  RAMP_TOO_STEEP: [
    'I can’t get up this slope.',
    'This ramp is too steep.',
    'I can’t push up this.',
  ],
  TROLLEY_ROLLBACK: [
    'The trolley is rolling back!',
    'It’s too steep to push.',
    'The sacks rolled back down.',
  ],
  NO_HANDRAIL: [
    'I need something to hold on to.',
    'There’s no handrail here.',
    'I can’t climb without a rail.',
  ],
  TIGHT_TURN: [
    'I can’t turn here.',
    'There’s no room to turn.',
    'My wheelchair can’t turn here.',
  ],
  NO_ACCESSIBLE_ROUTE: [
    'I can’t use the stairs.',
    'There’s no ramp for me.',
    'A trolley can’t take stairs.',
  ],
};

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

export type StuckKind = 'stuck' | 'blocked' | 'noWay';

/** What someone says when they are stuck or kept waiting (shown alongside the failure quotes). */
export const STUCK_LINES: Record<StuckKind, string[]> = {
  stuck: ['I’m stuck here.', 'I can’t move.', 'I can’t get through.'],
  blocked: ['Someone is in the way.', 'Please move, I need to pass.', 'The way is blocked.'],
  noWay: ['There’s no way through.', 'Where do I go?', 'There’s no way out.'],
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
