import { today, addDays } from './dates.js';

const STORAGE_KEY = 'tech-english:v1';

export function createState() {
  return {
    cards: {}, // flashcard id -> { box, due }
    stats: { streak: 0, lastStudyDate: null, answered: 0, correct: 0 },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createState();
    const saved = JSON.parse(raw);
    const base = createState();
    return { cards: { ...saved.cards }, stats: { ...base.stats, ...saved.stats } };
  } catch {
    return createState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode); the app still works for this session.
  }
}

export function recordAnswer(state, correct) {
  const stats = state.stats;
  const t = today();
  if (stats.lastStudyDate !== t) {
    stats.streak = stats.lastStudyDate === addDays(t, -1) ? stats.streak + 1 : 1;
    stats.lastStudyDate = t;
  }
  stats.answered += 1;
  if (correct) stats.correct += 1;
}

// The streak is only "alive" if the user studied today or yesterday.
export function currentStreak(state) {
  const { streak, lastStudyDate } = state.stats;
  const t = today();
  return lastStudyDate === t || lastStudyDate === addDays(t, -1) ? streak : 0;
}
