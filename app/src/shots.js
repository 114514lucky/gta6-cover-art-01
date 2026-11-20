// Fixed scenes for screenshots: ?shot=editor shows the page with the demo
// cast loaded; ?shot=cover shows the exported cover alone, drawn by the
// app itself at the chosen export size. Query keys: size, layout, grade,
// title, subtitle, tagline, quote. window.__shotReady is set once the
// scene has painted, so a screenshot tool can wait on it.
import { defaultState } from './state.js';

export function shotStateFromQuery(query) {
  const state = defaultState();
  const pick = (key) => {
    const v = query.get(key);
    return v === null || v === '' ? null : v;
  };
  const size = pick('size');
  if (size) state.size = size;
  const layout = pick('layout');
  if (layout) state.layout = layout;
  const grade = pick('grade');
  if (grade) state.grade = grade;
  const title = pick('title');
  if (title) state.title = title.toUpperCase();
  const subtitle = pick('subtitle');
  if (subtitle) state.subtitle = subtitle;
  const tagline = pick('tagline');
  if (tagline) state.tagline = tagline.toUpperCase();
  const quote = pick('quote');
  if (quote) state.quote = quote.toUpperCase();
  return state;
}

export function markShotReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
