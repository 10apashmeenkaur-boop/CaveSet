export type Quote = { text: string; who: string };

/** Fed-up characters, complaining with great dignity. One per screen visit. */
export const QUOTES: Record<'levels' | 'game' | 'journal', Quote[]> = {
  levels: [
    { text: 'I can only clean so much. The rest is between you and your floor plan.', who: 'Dishwasher, 22 years of service' },
    { text: 'Every building begins with a dream and ends with someone squeezing past a crate.', who: 'Retired crate carrier' },
    { text: 'I have walked eleven thousand steps today, and nine thousand were detours.', who: 'Tray carrier, deeply tired' },
    { text: 'Please. I am begging you. Think about the door.', who: 'Anyone who has carried anything, ever' },
  ],
  game: [
    { text: 'A door one tile wide is a lovely idea for a person holding nothing.', who: 'Crate carrier, wedged' },
    { text: 'I did not sign up to dance with strangers in a doorway.', who: 'Sevadar, stuck mid-"after you"' },
    { text: 'The door swings in. I stand where it swings. We are at an impasse, the door and I.', who: 'Patient visitor' },
    { text: 'Somewhere a blueprint looked perfect. It was not in this room.', who: 'Floor supervisor' },
    { text: 'I can only clean so much. The rest, dear designer, is your corridor.', who: 'The washing area, collectively' },
  ],
  journal: [
    { text: 'Every principle in this book was paid for by someone’s aching shoulders.', who: 'Crate carrier, philosophical' },
    { text: 'Failure is a teacher. It is also, occasionally, a jammed doorway.', who: 'Old kitchen saying, probably' },
    { text: 'Write it down so the next building doesn’t make me do this again.', who: 'Everyone' },
  ],
};

export function pickQuote(screen: keyof typeof QUOTES): Quote {
  const list = QUOTES[screen];
  return list[Math.floor(Math.random() * list.length)];
}
