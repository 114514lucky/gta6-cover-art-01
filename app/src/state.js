// Sunset Coast Cover Studio — shared state: sample cast, grades, layouts, sizes.
// Everything here is plain data plus a fresh default state; the renderer lives
// in cover.js and the page wiring in editor.js.

export const SAMPLES = [
  { key: 'boulevard', file: 'samples/boulevard.jpg', label: 'Boulevard', role: 'THE QUEEN' },
  { key: 'driver', file: 'samples/driver.jpg', label: 'Driver', role: 'THE DRIVER' },
  { key: 'pier', file: 'samples/pier.jpg', label: 'Captain', role: 'THE CAPTAIN' },
  { key: 'neon', file: 'samples/neon.jpg', label: 'Neon night', role: 'THE INSIDER' },
  { key: 'friends', file: 'samples/friends.jpg', label: 'The crew', role: 'THE CREW' },
  { key: 'rooftop', file: 'samples/rooftop.jpg', label: 'Rooftop', role: 'THE FIXER' },
];

export const GRADES = [
  {
    id: 'sunset', label: 'Sunset', saturate: 1.25, contrast: 1.08, brightness: 1.02,
    wash: ['#ff9a3d', '#ff2e88'], washAlpha: 0.34, blend: 'soft-light',
  },
  {
    id: 'neon', label: 'Neon Nights', saturate: 1.35, contrast: 1.12, brightness: 0.98,
    wash: ['#ff2e88', '#19c8d8'], washAlpha: 0.38, blend: 'overlay',
  },
  {
    id: 'gold', label: 'Vice Gold', saturate: 1.15, contrast: 1.06, brightness: 1.05,
    wash: ['#ffd94a', '#ff7a1a'], washAlpha: 0.3, blend: 'soft-light',
  },
  {
    id: 'teal', label: 'Palm Teal', saturate: 1.2, contrast: 1.1, brightness: 1.0,
    wash: ['#19c8d8', '#ff9a3d'], washAlpha: 0.32, blend: 'soft-light',
  },
  {
    id: 'mono', label: 'Mono Heat', saturate: 0.25, contrast: 1.22, brightness: 1.04,
    wash: ['#ff7a1a', '#7a1a4d'], washAlpha: 0.3, blend: 'overlay',
  },
];

export const LAYOUTS = [
  { id: 'poster', label: 'Six-panel poster' },
  { id: 'hero', label: 'Hero + three' },
];

export const SIZES = [
  { id: '1920x1080', label: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
  { id: '1080x1080', label: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
];

export function sizeById(id) {
  return SIZES.find((s) => s.id === id) ?? SIZES[0];
}

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

// The demo cast: six panels, six photos, six roles. Zoom is a cover-fit
// multiplier (1 fills the panel); ox/oy shift the focus point in fractions
// of the panel (-0.3 .. 0.3).
export function defaultState() {
  return {
    size: '1920x1080',
    layout: 'poster',
    grade: 'sunset',
    title: 'VICE COAST',
    subtitle: 'Chasing the last light',
    tagline: 'SIX STRANGERS · ONE SUNSET · NO BRAKES',
    quote: 'EVERY SUNSET HAS A PRICE',
    panels: [
      { photo: 'boulevard', zoom: 1.05, ox: 0.0, oy: -0.06, role: 'THE QUEEN' },
      { photo: 'driver', zoom: 1.06, ox: 0.0, oy: -0.02, role: 'THE DRIVER' },
      { photo: 'pier', zoom: 1.1, ox: 0.0, oy: -0.05, role: 'THE CAPTAIN' },
      { photo: 'neon', zoom: 1.08, ox: -0.05, oy: -0.02, role: 'THE INSIDER' },
      { photo: 'friends', zoom: 1.06, ox: 0.0, oy: 0.04, role: 'THE CREW' },
      { photo: 'rooftop', zoom: 1.1, ox: 0.02, oy: -0.05, role: 'THE FIXER' },
    ],
  };
}

// A plain-data copy of the state (photos are keys, never image objects),
// so undo history and the export path stay cheap and serialisable.
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}
