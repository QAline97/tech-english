// Spaced repetition using the Leitner system:
// each card lives in a "box"; knowing it moves it up (longer wait),
// missing it sends it back to box 0 (review again today).
import { today, addDays } from './dates.js';
import { shuffle } from './dom.js';

const INTERVALS = [0, 1, 3, 7, 14, 30]; // days until next review, per box
export const MASTERED_BOX = 3;
export const NEW_CARDS_PER_SESSION = 10;

export function buildQueue(cards, progress, t = today()) {
  const due = cards.filter((c) => progress[c.id] && progress[c.id].due <= t);
  const fresh = cards.filter((c) => !progress[c.id]).slice(0, NEW_CARDS_PER_SESSION);
  return [...shuffle(due), ...fresh];
}

export function review(cardProgress, knewIt, t = today()) {
  const box = knewIt ? Math.min((cardProgress?.box ?? 0) + 1, INTERVALS.length - 1) : 0;
  return { box, due: addDays(t, INTERVALS[box]) };
}
