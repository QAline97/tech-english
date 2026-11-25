import { today, addDays } from './dates.js';

const STORAGE_KEY = 'tech-english:v1';

export function createState() {
  return {
    cards: {}, // flashcard id -> { box, due }
    mistakes: {}, // content id -> how many times it was missed (minus later hits)
    stats: { streak: 0, lastStudyDate: null, answered: 0, correct: 0 },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createState();
    const saved = JSON.parse(raw);
    const base = createState();
    return {
      cards: { ...saved.cards },
      mistakes: { ...saved.mistakes },
      stats: { ...base.stats, ...saved.stats },
    };
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

// Tracks which items the learner gets wrong, so the AI tutor can practice them.
export function recordItemResult(state, id, correct) {
  const count = state.mistakes[id] ?? 0;
  if (!correct) state.mistakes[id] = Math.min(count + 1, 5);
  else if (count > 1) state.mistakes[id] = count - 1;
  else delete state.mistakes[id];
}

// Most-missed items first, then flashcards whose last answer was wrong (box 0).
export function weakItemIds(state, limit = 15) {
  const ids = Object.entries(state.mistakes)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  for (const [id, progress] of Object.entries(state.cards)) {
    if (progress.box === 0 && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, limit);
}
