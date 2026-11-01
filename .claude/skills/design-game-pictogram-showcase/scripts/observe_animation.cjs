#!/usr/bin/env node
// Observe showcase pictogram candidates in a real browser (Playwright Chromium) and report:
//   (a) the static state against the end (once: every animation at its own end), the hold before the
//       switch (cut) or the seam (seam), by computed style of every visible element, in light and dark
//   (b) for cut, real frames around each cycle boundary (detected by currentIteration, so a delay is
//       allowed): the frame before / after the switch and the number of in-between frames
//   (c) real frames from the moment the SVG is inserted: an element that shows the static state while
//       its animation is still in its delay, and (once / cut) a first frame equal to the static state
//   (d) that the hero stays in the static state under prefers-reduced-motion: reduce, in light and dark
//   (e) how far any visible shape goes outside the 0 0 120 120 viewBox over one cycle
//   (f) speed continuity: every moving shape is scanned with paused time every 2ms and the jump of its
//       velocity between neighbouring steps (relative to its peak speed) is reported (WARN only)
//   (g) optional: overlap between the shapes of two selectors over one cycle (--overlap A|B, WARN only)
//   (h) the static state's visible bounds (viewBox units, stroke included) against the base pictogram and
//       the median of the other games' pictogram.svg, and its ink coverage at list size against theirs
//       (NOTE only; references/motion.md)
//   (i) pageerror / console.error
//   (j) optional: a filmstrip of real-time screenshots of the 138px hero over one cycle (--filmstrip)
//   (k) optional: static / end screenshots and errors in WebKit when it can be launched (--webkit)
// Each candidate is rendered alone in its own page (never in a srcdoc iframe; see references/self-review.md).
// The host defines the color tokens of frontend/styles/globals.css (:root and .dark) like the app, so an
// SVG may reference the app color tokens with var().
'use strict';

const fs = require('fs');
const path = require('path');
const { loadPlaywright } = require('./playwright_resolve.cjs');

const USAGE = `usage: node observe_animation.cjs --manifest <manifest.json> [options]
  --only id,id               observe only these candidates
  --out <dir>                screenshots and observe-report.json (default: <manifest dir>/observe)
  --cycles <n>               cut: cycles of real frames to record (default 3.3)
  --pixels                   pixel difference between the end and the static screenshots
  --overlap '<sel>|<sel>'    overlap of two selectors over one cycle (repeatable; the manifest
                             candidate field "overlap" adds pairs per candidate)
  --smooth-threshold <x>     speed jump relative to peak that is a WARN (default 0.15)
  --filmstrip                real-time screenshots of the 138px hero over one cycle, in one image
  --filmstrip-interval <ms>  minimum time between filmstrip frames (default 100)
  --webkit                   also render the static state and the end in WebKit, if it can be launched
  --globals-css <file>       theme colors (default: frontend/styles/globals.css)
  --games-dir <dir>          other games' pictogram.svg for size and ink comparison
  -h, --help                 show this help`;

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../..');
const DEFAULT_GLOBALS_CSS = path.join(REPOSITORY_ROOT, 'frontend/styles/globals.css');
const DEFAULT_GAMES_DIR = path.join(REPOSITORY_ROOT, 'frontend/src/games');
const THEME_SELECTORS = { light: ':root', dark: '.dark' };
const THEME_TOKENS = ['foreground', 'muted-foreground', 'background'];
const FILMSTRIP_HERO_INDEX = 1;
const FILMSTRIP_COLUMNS = 8;
const FALLBACK_THEMES = {
  light: { foreground: 'oklch(0.145 0 0)', 'muted-foreground': 'oklch(0.556 0 0)', background: 'oklch(1 0 0)' },
  dark: { foreground: 'oklch(0.985 0 0)', 'muted-foreground': 'oklch(0.708 0 0)', background: 'oklch(0.145 0 0)' },
};
const HERO_SIZES = [177, 138];
// The selected list pictogram in the app is about 46px (phone) / 56px (desktop).
const LIST_SIZE = 46;
const NUMBER_TOLERANCE = 0.01;
const END_OFFSET_MS = 0.01;
const OVERFLOW_STEP_MS = 20;
const HOLD_STEP_MS = 10;
const SMOOTH_STEP_MS = 2;
const SEAM_SCAN_PAST_MS = 200;
const FLASH_MIN_RECORD_MS = 300;
const PIXEL_CHANNEL_THRESHOLD = 24;
const OVERLAP_MIN_AREA = 0.25;
const PLAYBACKS = new Set(['once', 'cut', 'seam']);

function parseOverlap(value) {
  const pair = String(value).split('|').map((part) => part.trim());
  if (pair.length !== 2 || !pair[0] || !pair[1]) throw new Error(`overlap takes '<selector>|<selector>': ${value}`);
  return pair;
}

function parseArgs(argv) {
  const args = { cycles: 3.3, only: [], pixels: false, overlap: [], smoothThreshold: 0.15, globalsCss: DEFAULT_GLOBALS_CSS, gamesDir: DEFAULT_GAMES_DIR,
    filmstrip: false, filmstripInterval: 100, webkit: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '-h' || flag === '--help') { console.log(USAGE); process.exit(0); }
    else if (flag === '--manifest') args.manifest = argv[++i];
    else if (flag === '--out') args.out = argv[++i];
    else if (flag === '--only') args.only = argv[++i].split(',').filter(Boolean);
    else if (flag === '--cycles') args.cycles = Number(argv[++i]);
    else if (flag === '--pixels') args.pixels = true;
    else if (flag === '--smooth-threshold') args.smoothThreshold = Number(argv[++i]);
    else if (flag === '--globals-css') args.globalsCss = argv[++i];
    else if (flag === '--games-dir') args.gamesDir = argv[++i];
    else if (flag === '--filmstrip') args.filmstrip = true;
    else if (flag === '--filmstrip-interval') args.filmstripInterval = Number(argv[++i]);
    else if (flag === '--webkit') args.webkit = true;
    else if (flag === '--overlap') args.overlap.push(parseOverlap(argv[++i]));
    else throw new Error(`unknown argument: ${flag}\n${USAGE}`);
  }
  if (!args.manifest) throw new Error(USAGE);
  return args;
}

function candidateOverlaps(candidate, globalPairs) {
  const own = candidate.overlap == null ? [] : (Array.isArray(candidate.overlap) ? candidate.overlap : [candidate.overlap]);
  return [...globalPairs, ...own.map(parseOverlap)];
}

function loadThemes(file) {
  let css;
  try {
    css = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`WARN: cannot read ${file}; using fallback theme values: ${error.message}`);
    return FALLBACK_THEMES;
  }
  const themes = {};
  for (const [theme, selector] of Object.entries(THEME_SELECTORS)) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const block = (css.match(new RegExp(`^${escaped}\\s*\\{([\\s\\S]*?)^\\}`, 'm')) || [])[1] || '';
    themes[theme] = { tokens: Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])) };
    for (const token of THEME_TOKENS) {
      const value = themes[theme].tokens[`--${token}`];
      if (!value) console.error(`WARN: --${token} not found in ${selector} of ${file}; using fallback`);
      themes[theme][token] = value || FALLBACK_THEMES[theme][token];
    }
  }
  return themes;
}

// The host page: play attribute on an ancestor span, .dark on <html>, like the app. With deferred the
// hosts are empty and the SVG is inserted later by __pz.live() so that its very first frames are seen.
function hostPage(svg, { play, theme, themes, deferred }) {
  const colors = themes[theme];
  const motion = play ? ' data-pictogram-motion="play"' : '';
  const content = deferred ? '' : svg;
  const heroes = HERO_SIZES.map((size) => `<span class="host hero"${motion} style="width:${size}px;height:${size}px">${content}</span>`).join('');
  const declarations = (tokens) => Object.entries(tokens || {}).map(([name, value]) => `${name}:${value}`).join(';');
  return `<!doctype html><html${theme === 'dark' ? ' class="dark"' : ''}><head><style>
:root{${declarations(themes.light.tokens)}}
.dark{${declarations(themes.dark.tokens)}}
html,body{margin:0;background:${colors.background}}
body{display:flex;gap:8px;align-items:flex-start;padding:8px}
.host{display:block;--game-pictogram-strong:${colors.foreground};--game-pictogram-soft:${colors['muted-foreground']}}
.host>svg{display:block;width:100%;height:100%}
</style></head><body>${heroes}<span class="host list" style="width:${LIST_SIZE}px;height:${LIST_SIZE}px">${content}</span></body></html>`;
}

// Runs in the page. Collects the computed style that decides how each element looks, and seeks / scans.
const IN_PAGE = `
window.__pz = (() => {
  const PROPS = ['transform', 'translate', 'rotate', 'scale', 'opacity', 'fill', 'stroke', 'fill-opacity',
    'stroke-opacity', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'visibility', 'display', 'd',
    'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'clip-path', 'offset-distance', 'stop-color'];
  const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text']);
  const SKIP = new Set(['style', 'title', 'desc', 'metadata', 'defs']);
  const firstHero = () => document.querySelector('.host.hero');
  const elementsOf = (host) => [...host.querySelector('svg').querySelectorAll('*')]
    .filter((el) => !SKIP.has(el.localName) && !el.closest('defs'));
  const keyOf = (el, index) => index + ':' + el.localName + (el.getAttribute('class') ? '.' + el.getAttribute('class') : '');
  const effectiveOpacity = (el, svg) => {
    let value = 1;
    for (let node = el; node && node !== svg.parentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return 0;
      value *= Number(style.opacity);
    }
    return value;
  };
  const state = (host = firstHero()) => {
    const svg = host.querySelector('svg');
    return elementsOf(host).map((el, index) => {
      const style = getComputedStyle(el);
      const props = {};
      for (const prop of PROPS) props[prop] = style.getPropertyValue(prop);
      return { key: keyOf(el, index), visible: effectiveOpacity(el, svg) > 0.001, props };
    });
  };
  const animations = (host) => host ? host.getAnimations({ subtree: true }) : document.getAnimations();
  const timings = () => animations(firstHero()).map((animation) => {
    const timing = animation.effect.getComputedTiming();
    return { delay: timing.delay || 0, duration: Number(timing.duration) || 0, finite: Number.isFinite(timing.iterations),
      endTime: Number.isFinite(timing.endTime) ? timing.endTime : null };
  });
  // Seek every animation to one absolute time.
  const seek = (time) => animations().forEach((animation) => { animation.pause(); animation.currentTime = time; });
  // Seek every animation to its own start (its delay, the 0% keyframe) or its own end: just before the end
  // of a one-shot animation, or just before the end of the first iteration of a loop.
  const seekEach = (where, epsilon) => animations().forEach((animation) => {
    const timing = animation.effect.getComputedTiming();
    const delay = timing.delay || 0;
    const end = Number.isFinite(timing.endTime) ? timing.endTime : delay + Number(timing.duration || 0);
    animation.pause();
    animation.currentTime = where === 'start' ? delay : end - epsilon;
  });
  // Union of the visible shapes (stroke included) in viewBox units.
  const bounds = () => {
    const host = firstHero();
    const svg = host.querySelector('svg');
    const box = svg.getBoundingClientRect();
    const unit = 120 / box.width;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    elementsOf(host).forEach((el) => {
      if (!SHAPES.has(el.localName) || effectiveOpacity(el, svg) <= 0.001) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const style = getComputedStyle(el);
      const screen = el.getScreenCTM();
      const half = style.stroke !== 'none' ? (parseFloat(style.strokeWidth) || 0) * (screen ? Math.hypot(screen.a, screen.b) : 1) / 2 : 0;
      left = Math.min(left, rect.left - half); top = Math.min(top, rect.top - half);
      right = Math.max(right, rect.right + half); bottom = Math.max(bottom, rect.bottom + half);
    });
    if (!Number.isFinite(left)) return null;
    const round = (value) => Number(value.toFixed(1));
    const width = (right - left) * unit, height = (bottom - top) * unit;
    return { width: round(width), height: round(height), centerX: round(((left + right) / 2 - box.left) * unit), centerY: round(((top + bottom) / 2 - box.top) * unit) };
  };
  const overflow = () => {
    const host = firstHero();
    const svg = host.querySelector('svg');
    const box = svg.getBoundingClientRect();
    const unit = 120 / box.width;
    let worst = { margin: Infinity, key: null };
    elementsOf(host).forEach((el, index) => {
      if (!SHAPES.has(el.localName) || effectiveOpacity(el, svg) <= 0.001) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const style = getComputedStyle(el);
      let strokePx = 0;
      if (style.stroke !== 'none') {
        const screen = el.getScreenCTM();
        strokePx = (parseFloat(style.strokeWidth) || 0) * (screen ? Math.hypot(screen.a, screen.b) : 1) / 2;
      }
      const margin = (Math.min(rect.left - box.left, box.right - rect.right, rect.top - box.top, box.bottom - rect.bottom) - strokePx) * unit;
      if (margin < worst.margin) worst = { margin, key: keyOf(el, index) };
    });
    return worst;
  };
  // Area (viewBox units^2) covered by a visible shape of both selectors: bounding boxes first, then a
  // 1px grid tested with isPointInFill / isPointInStroke in each shape's own coordinates.
  const overlap = (pairs) => {
    const host = firstHero();
    const svg = host.querySelector('svg');
    const unit = 120 / svg.getBoundingClientRect().width;
    const shapesOf = (selector) => [...svg.querySelectorAll(selector)]
      .flatMap((el) => [el, ...el.querySelectorAll('*')])
      .filter((el) => SHAPES.has(el.localName) && effectiveOpacity(el, svg) > 0.001);
    const inside = (el, x, y) => {
      const matrix = el.getScreenCTM();
      if (!matrix) return false;
      const point = new DOMPoint(x, y).matrixTransform(matrix.inverse());
      if (el.isPointInFill(point)) return true;
      return getComputedStyle(el).stroke !== 'none' && el.isPointInStroke(point);
    };
    return pairs.map(([selectorA, selectorB]) => {
      const groupA = shapesOf(selectorA);
      const groupB = shapesOf(selectorB).filter((el) => !groupA.includes(el));
      let hits = 0;
      const counted = new Set();
      for (const a of groupA) {
        const ra = a.getBoundingClientRect();
        for (const b of groupB) {
          const rb = b.getBoundingClientRect();
          const left = Math.max(ra.left, rb.left), right = Math.min(ra.right, rb.right);
          const top = Math.max(ra.top, rb.top), bottom = Math.min(ra.bottom, rb.bottom);
          if (right <= left || bottom <= top) continue;
          for (let x = Math.floor(left) + 0.5; x < right; x += 1) {
            for (let y = Math.floor(top) + 0.5; y < bottom; y += 1) {
              const key = x + ',' + y;
              if (counted.has(key)) continue;
              if (inside(a, x, y) && inside(b, x, y)) { counted.add(key); hits++; }
            }
          }
        }
      }
      return hits * unit * unit;
    });
  };
  // Speed continuity: positions (viewBox units) of the bounding-box corners and centre of every shape,
  // through getScreenCTM (it includes the CSS transforms), at paused times from..to every step ms.
  const smoothness = (from, to, step) => {
    const host = firstHero();
    const svg = host.querySelector('svg');
    const unit = 120 / svg.getBoundingClientRect().width;
    const shapes = elementsOf(host).map((el, index) => ({ el, key: keyOf(el, index) })).filter(({ el }) => SHAPES.has(el.localName));
    const series = shapes.map(() => []);
    const times = [];
    for (let time = from; time < to; time += step) {
      seek(time);
      times.push(time);
      shapes.forEach(({ el }, k) => {
        const matrix = el.getScreenCTM();
        let box = null;
        try { box = el.getBBox(); } catch {}
        if (!matrix || !box || effectiveOpacity(el, svg) <= 0.001) { series[k].push(null); return; }
        const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height],
          [box.x + box.width, box.y + box.height], [box.x + box.width / 2, box.y + box.height / 2]];
        series[k].push(corners.map(([x, y]) => { const p = new DOMPoint(x, y).matrixTransform(matrix); return [p.x * unit, p.y * unit]; }));
      });
    }
    const results = [];
    shapes.forEach(({ key }, k) => {
      const samples = series[k];
      const velocities = [];
      let peak = 0;
      let extent = 0;
      for (let i = 1; i < samples.length; i++) {
        if (!samples[i] || !samples[i - 1]) { velocities.push(null); continue; }
        const v = samples[i].map((p, j) => [(p[0] - samples[i - 1][j][0]) / step, (p[1] - samples[i - 1][j][1]) / step]);
        velocities.push(v);
        v.forEach(([vx, vy]) => { peak = Math.max(peak, Math.hypot(vx, vy)); });
      }
      const visible = samples.filter(Boolean);
      if (visible.length) {
        visible[0].forEach((_, j) => {
          const xs = visible.map((s) => s[j][0]); const ys = visible.map((s) => s[j][1]);
          extent = Math.max(extent, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
        });
      }
      if (extent < 0.5 || peak === 0) return;
      let worst = 0, at = null;
      for (let i = 1; i < velocities.length; i++) {
        const a = velocities[i - 1], b = velocities[i];
        if (!a || !b) continue;
        a.forEach(([ax, ay], j) => {
          const [bx, by] = b[j];
          if (Math.max(Math.hypot(ax, ay), Math.hypot(bx, by)) < peak * 0.02) return;
          const jump = Math.hypot(bx - ax, by - ay) / peak;
          if (jump > worst) { worst = jump; at = times[i]; }
        });
      }
      results.push({ element: key, peakUnitsPerSecond: Number((peak * 1000).toFixed(1)), worstJump: Number(worst.toFixed(3)), atMs: at });
    });
    return results;
  };
  // Insert the SVG into every (empty) host and record real frames from the first one. Each frame keeps
  // the reference animation time and iteration, the state, and which elements are still in their delay.
  const live = (svg, durationMs) => new Promise((resolve) => {
    document.querySelectorAll('.host').forEach((host) => { host.innerHTML = svg; });
    const frames = [];
    const start = performance.now();
    const tick = () => {
      const host = firstHero();
      const reference = animations(host)[0];
      const timing = reference ? reference.effect.getComputedTiming() : null;
      const delayed = elementsOf(host).map((el) => {
        const own = el.getAnimations();
        return own.length > 0 && own.every((animation) => (animation.currentTime || 0) < (animation.effect.getComputedTiming().delay || 0));
      });
      frames.push({ time: reference ? reference.currentTime || 0 : null, iteration: timing ? timing.currentIteration : null, state: state(), delayed });
      if (performance.now() - start < durationMs) requestAnimationFrame(tick); else resolve(frames);
    };
    requestAnimationFrame(tick);
  });
  return { state, timings, seek, seekEach, bounds, overflow, overlap, smoothness, live, count: () => animations().length };
})();
`;

const TRANSFORM_IDENTITY = { transform: 'matrix(1, 0, 0, 1, 0, 0)', translate: '0px', rotate: '0deg', scale: '1' };

function normalize(prop, value) {
  const trimmed = String(value).trim();
  return trimmed === 'none' && TRANSFORM_IDENTITY[prop] ? TRANSFORM_IDENTITY[prop] : trimmed;
}

function sameValue(prop, a, b) {
  const left = normalize(prop, a);
  const right = normalize(prop, b);
  if (left === right) return true;
  const numbers = /-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi;
  if (left.replace(numbers, '#') !== right.replace(numbers, '#')) return false;
  const leftNumbers = left.match(numbers) || [];
  const rightNumbers = right.match(numbers) || [];
  return leftNumbers.every((n, i) => Math.abs(Number(n) - Number(rightNumbers[i])) <= NUMBER_TOLERANCE);
}

// Differences of one element; an element invisible in both is ignored (its transform or color does not show).
function elementDifferences(element, other) {
  if (!element.visible && !other.visible) return [];
  if (element.visible !== other.visible) return [`${element.key} visible ${element.visible} / ${other.visible}`];
  return Object.keys(element.props)
    .filter((prop) => !sameValue(prop, element.props[prop], other.props[prop]))
    .map((prop) => `${element.key} ${prop}: ${element.props[prop]} / ${other.props[prop]}`);
}

function differences(a, b) {
  return a.flatMap((element, index) => elementDifferences(element, b[index]));
}

async function pixelDifference(page, a, b) {
  return page.evaluate(async ([left, right, threshold]) => {
    const load = (data) => new Promise((resolve) => { const image = new Image(); image.onload = () => resolve(image); image.src = 'data:image/png;base64,' + data; });
    const [imageA, imageB] = await Promise.all([load(left), load(right)]);
    const canvas = document.createElement('canvas');
    canvas.width = imageA.width; canvas.height = imageA.height;
    const context = canvas.getContext('2d');
    context.drawImage(imageA, 0, 0); const dataA = context.getImageData(0, 0, canvas.width, canvas.height).data;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(imageB, 0, 0); const dataB = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0; let max = 0;
    for (let i = 0; i < dataA.length; i += 4) {
      const d = Math.max(Math.abs(dataA[i] - dataB[i]), Math.abs(dataA[i + 1] - dataB[i + 1]), Math.abs(dataA[i + 2] - dataB[i + 2]));
      if (d > threshold) count++;
      max = Math.max(max, d);
    }
    return { pixels: count, ratio: count / (canvas.width * canvas.height), max };
  }, [a.toString('base64'), b.toString('base64'), PIXEL_CHANNEL_THRESHOLD]);
}

async function render(context, svg, options) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push('pageerror: ' + error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console.error: ' + message.text()); });
  await page.setContent(hostPage(svg, options));
  await page.addScriptTag({ content: IN_PAGE });
  return { page, errors };
}

// Jumps of several shapes at (nearly) the same time share one cause (one segment boundary moving a group),
// so they are reported once per time, worst first.
function groupJumps(entries) {
  const sorted = [...entries].sort((a, b) => a.atMs - b.atMs);
  const groups = [];
  for (const entry of sorted) {
    const last = groups[groups.length - 1];
    if (last && entry.atMs - last[last.length - 1].atMs <= 2 * SMOOTH_STEP_MS) last.push(entry);
    else groups.push([entry]);
  }
  return groups.map((group) => group.sort((a, b) => b.worstJump - a.worstJump));
}

function classify(state, references) {
  for (const [label, reference] of Object.entries(references)) {
    if (differences(state, reference).length === 0) return label;
  }
  return 'M';
}

// Reads the rAF record around every cycle boundary of a cut loop. A boundary is where the iteration of
// the reference animation goes up, so an animation-delay before the first iteration does not shift it.
function cutBoundaries(frames, references) {
  const classes = frames.map((frame) => classify(frame.state, references));
  const boundaries = [];
  for (let i = 1; i < frames.length; i++) {
    const previous = frames[i - 1].iteration;
    const current = frames[i].iteration;
    if (previous == null || current == null || current <= previous) continue;
    let before = i - 1;
    while (before >= 0 && classes[before] !== 'S') before--;
    const intermediateBefore = i - 1 - before;
    let holdStart = before;
    while (holdStart > 0 && classes[holdStart - 1] === 'S') holdStart--;
    let firstStart = i;
    while (firstStart < frames.length && classes[firstStart] !== 'P0' && frames[firstStart].time - frames[i].time < 500) firstStart++;
    const reachedStart = firstStart < frames.length && classes[firstStart] === 'P0';
    const intermediateAfter = reachedStart ? firstStart - i : 0;
    let beatEnd = firstStart;
    while (reachedStart && beatEnd + 1 < frames.length && classes[beatEnd + 1] === 'P0') beatEnd++;
    boundaries.push({
      atMs: Math.round(frames[i].time),
      frameBefore: classes[i - 1],
      frameAfter: classes[i],
      intermediateFrames: intermediateBefore + intermediateAfter,
      holdMs: before >= 0 ? Math.round(frames[before].time - frames[holdStart].time) : 0,
      startBeatMs: reachedStart ? Math.round(frames[beatEnd].time - frames[firstStart].time) : 0,
    });
  }
  return { boundaries, firstFrame: classes[0] };
}

// Elements that show the static state in real frames while their animation is still in its delay,
// although their start pose (0% keyframe) differs from it: animation-fill-mode backwards / both is missing.
function delayFlashes(frames, startState, staticState) {
  const flashes = new Map();
  frames.forEach((frame, index) => {
    frame.delayed.forEach((delayed, k) => {
      if (!delayed || flashes.has(k)) return;
      if (!elementDifferences(startState[k], staticState[k]).length) return;
      if (!elementDifferences(frame.state[k], staticState[k]).length) flashes.set(k, { element: frame.state[k].key, frame: index, atMs: Math.round(frame.time || 0) });
    });
  });
  return [...flashes.values()];
}

// Mean ink of the list-size static pictogram: per pixel, its colour distance from the background
// relative to the foreground's (1 = a foreground pixel, 0 = background), averaged over the square.
// Unlike the bounds, it reflects how much is drawn inside the outline, so board-like pictograms compare.
async function inkCoverage(page, themes) {
  const shot = await page.locator('.host.list').screenshot();
  return page.evaluate(async ([data, background, foreground]) => {
    const toRgb = (color) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const image = await new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.src = 'data:image/png;base64,' + data; });
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const bg = toRgb(background); const fg = toRgb(foreground);
    const distance = (r, g, b) => Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2]));
    const full = distance(...fg) || 1;
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) sum += Math.min(1, distance(pixels[i], pixels[i + 1], pixels[i + 2]) / full);
    return sum / (pixels.length / 4);
  }, [shot.toString('base64'), themes.light.background, themes.light.foreground]);
}

async function staticMeasures(context, svg, themes) {
  const { page } = await render(context, svg, { play: false, theme: 'light', themes });
  const bounds = await page.evaluate(() => window.__pz.bounds());
  const ink = await inkCoverage(page, themes);
  await page.close();
  return { bounds, ink };
}

const size = (bounds) => Math.sqrt(bounds.width * bounds.height);
const bottom = (bounds) => bounds.centerY + bounds.height / 2;
const median = (values) => { const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };

// Bounds of the base pictogram and of the other games' pictogram.svg, measured once.
async function referenceBounds(browser, manifest, manifestPath, options) {
  const context = await browser.newContext({ viewport: { width: 420, height: 200 }, deviceScaleFactor: 1 });
  const result = { base: null, others: [] };
  if (manifest.base_pictogram) {
    const file = path.isAbsolute(manifest.base_pictogram) ? manifest.base_pictogram : path.join(path.dirname(manifestPath), manifest.base_pictogram);
    if (fs.existsSync(file)) {
      const measures = await staticMeasures(context, fs.readFileSync(file, 'utf8'), options.themes);
      result.base = measures.bounds;
      result.baseInk = measures.ink;
    }
  }
  if (fs.existsSync(options.gamesDir)) {
    for (const game of fs.readdirSync(options.gamesDir).sort()) {
      const file = path.join(options.gamesDir, game, 'assets/pictogram.svg');
      if (game === manifest.game_id || !fs.existsSync(file)) continue;
      const { bounds, ink } = await staticMeasures(context, fs.readFileSync(file, 'utf8'), options.themes);
      if (bounds) result.others.push({ game, ...bounds, ink });
    }
  }
  await context.close();
  return result;
}

// Static state, start pose and end pose in one theme; compares the end (and the seam start) with the static state.
async function poses(context, svg, candidate, theme, options, report) {
  const suffix = theme === 'light' ? '' : `-${theme}`;
  const rest = await render(context, svg, { play: false, theme, themes: options.themes });
  const staticState = await rest.page.evaluate(() => window.__pz.state());
  const staticShot = await rest.page.locator('.host.hero').first().screenshot();
  fs.writeFileSync(path.join(options.out, `${candidate.id}${suffix}-static.png`), staticShot);

  const play = await render(context, svg, { play: true, theme, themes: options.themes });
  const timings = await play.page.evaluate(() => window.__pz.timings());
  const result = { rest, play, staticState, timings };
  if (!timings.length) return result;
  const shot = async (name) => {
    const buffer = await play.page.locator('.host.hero').first().screenshot();
    fs.writeFileSync(path.join(options.out, `${candidate.id}${suffix}-${name}.png`), buffer);
    return buffer;
  };
  await play.page.evaluate(() => window.__pz.seekEach('start', 0));
  result.startState = await play.page.evaluate(() => window.__pz.state());
  await shot('start');
  await play.page.evaluate((epsilon) => window.__pz.seekEach('end', epsilon), END_OFFSET_MS);
  result.endState = await play.page.evaluate(() => window.__pz.state());
  const endShot = await shot('end');
  const label = { once: 'end', cut: 'hold (100%)', seam: 'seam (100%)' }[candidate.playback];
  const endDiff = differences(result.endState, staticState);
  report.themes[theme].endVsStatic = endDiff;
  if (endDiff.length) report.failures.push(`${theme}: ${label} differs from the static state: ${endDiff.slice(0, 5).join(' | ')}`);
  if (candidate.playback === 'seam') {
    const startDiff = differences(result.startState, staticState);
    report.themes[theme].startVsStatic = startDiff;
    if (startDiff.length) report.failures.push(`${theme}: seam (0%) differs from the static state: ${startDiff.slice(0, 5).join(' | ')}`);
  }
  if (options.pixels) report.themes[theme].endVsStaticPixels = await pixelDifference(play.page, endShot, staticShot);
  return result;
}

async function reducedMotion(browser, svg, theme, staticState, options, report) {
  const reduced = await browser.newContext({ viewport: { width: 420, height: 200 }, reducedMotion: 'reduce' });
  const page = await render(reduced, svg, { play: true, theme, themes: options.themes });
  const count = await page.page.evaluate(() => window.__pz.count());
  const diff = differences(await page.page.evaluate(() => window.__pz.state()), staticState);
  report.themes[theme].reducedMotion = { animations: count, differences: diff };
  if (count || diff.length) report.failures.push(`${theme}: reduced motion is not the static state: ${count} animation(s), ${diff.length} difference(s)`);
  await reduced.close();
  return page.errors;
}

async function observe(browser, candidate, options) {
  const report = { id: candidate.id, playback: candidate.playback, failures: [], warnings: [], notes: [], themes: { light: {}, dark: {} } };
  const fail = (message) => report.failures.push(message);
  const svg = fs.readFileSync(candidate.file, 'utf8');
  const context = await browser.newContext({ viewport: { width: 420, height: 200 }, deviceScaleFactor: 1 });
  const errors = [];

  const dark = await poses(context, svg, candidate, 'dark', options, report);
  errors.push(...dark.rest.errors, ...dark.play.errors, ...(await reducedMotion(browser, svg, 'dark', dark.staticState, options, report)));
  const light = await poses(context, svg, candidate, 'light', options, report);
  errors.push(...(await reducedMotion(browser, svg, 'light', light.staticState, options, report)));
  const { play, staticState, startState, timings } = light;
  const bounds = await light.rest.page.evaluate(() => window.__pz.bounds());
  if (bounds) {
    const references = options.references;
    report.staticBounds = { ...bounds };
    if (references.base) {
      report.staticBounds.vsBase = { dx: Number((bounds.centerX - references.base.centerX).toFixed(1)), dy: Number((bounds.centerY - references.base.centerY).toFixed(1)), sizeRatio: Number((size(bounds) / size(references.base)).toFixed(2)) };
    }
    if (references.others.length) {
      report.staticBounds.vsOthers = { games: references.others.length, sizeRatioToMedian: Number((size(bounds) / median(references.others.map(size))).toFixed(2)),
        centerYMedian: Number(median(references.others.map((b) => b.centerY)).toFixed(1)), bottomMedian: Number(median(references.others.map(bottom)).toFixed(1)) };
    }
  }
  const ink = await inkCoverage(light.rest.page, options.themes);
  report.ink = { coverage: Number(ink.toFixed(3)), listSize: LIST_SIZE };
  if (options.references.baseInk) report.ink.vsBase = Number((ink / options.references.baseInk).toFixed(2));
  if (options.references.others.length) {
    const othersMedian = median(options.references.others.map((other) => other.ink));
    report.ink.othersMedian = Number(othersMedian.toFixed(3));
    report.ink.vsOthersMedian = Number((ink / othersMedian).toFixed(2));
    report.ink.others = options.references.others.map((other) => ({ game: other.game, coverage: Number(other.ink.toFixed(3)) }));
    const inks = options.references.others.map((other) => other.ink);
    report.ink.othersRange = [Number(Math.min(...inks).toFixed(3)), Number(Math.max(...inks).toFixed(3))];
    if (ink < Math.min(...inks) || ink > Math.max(...inks)) {
      report.notes.push(`ink coverage at ${LIST_SIZE}px (${(ink * 100).toFixed(1)}%) is outside the other games' range ${report.ink.othersRange.map((v) => (v * 100).toFixed(1) + '%').join('-')}; check the weight in the comparison row`);
    }
  }
  if (!timings.length) fail('no running animation with the play attribute');

  if (timings.length) {
    const loop = candidate.playback !== 'once';
    const reference = timings[0];
    const windowEnd = Math.max(...timings.map((t) => (t.finite && t.endTime != null ? t.endTime : t.delay + t.duration)));
    report.periodMs = Math.round(loop ? reference.duration : windowEnd);
    report.delayMs = Math.round(Math.max(...timings.map((t) => t.delay)));
    const at = async (time) => { await play.page.evaluate((t) => window.__pz.seek(t), time); return play.page.evaluate(() => window.__pz.state()); };

    if (candidate.playback === 'cut') {
      if (timings.some((t) => t.duration !== reference.duration || t.delay !== reference.delay)) {
        report.notes.push('animations do not share one duration and delay; hold and start beat follow the first animation');
      }
      if (differences(startState, staticState).length === 0) {
        fail('0% equals the static state: a cut loop starts from a different pose; if 0% = 100% declare seam');
      }
      const cycleStart = reference.delay;
      const cycleEnd = reference.delay + reference.duration - END_OFFSET_MS;
      let holdStart = cycleEnd;
      for (let time = cycleEnd; time >= cycleStart; time -= HOLD_STEP_MS) {
        if (differences(await at(time), staticState).length) break;
        holdStart = time;
      }
      report.holdMs = Math.round(cycleEnd + END_OFFSET_MS - holdStart);
      let beatEnd = 0;
      for (let time = cycleStart; time < cycleEnd; time += HOLD_STEP_MS) {
        if (differences(await at(time), startState).length) break;
        beatEnd = time - cycleStart;
      }
      report.startBeatMs = beatEnd;
      report.stillRatio = Number(((report.holdMs + report.startBeatMs) / reference.duration).toFixed(3));
    }

    let worst = { margin: Infinity, key: null, atMs: 0 };
    const overlapPairs = candidateOverlaps(candidate, options.overlap);
    const overlaps = overlapPairs.map((pair) => ({ pair: pair.join(' | '), maxArea: 0, atMs: null }));
    for (let time = 0; time < windowEnd; time += OVERFLOW_STEP_MS) {
      await play.page.evaluate((t) => window.__pz.seek(t), time);
      const sample = await play.page.evaluate(() => window.__pz.overflow());
      if (sample.margin < worst.margin) worst = { ...sample, atMs: time };
      if (overlaps.length) {
        const areas = await play.page.evaluate((pairs) => window.__pz.overlap(pairs), overlapPairs);
        areas.forEach((area, i) => { if (area > overlaps[i].maxArea) { overlaps[i].maxArea = area; overlaps[i].atMs = time; } });
      }
    }
    report.minViewBoxMargin = { margin: Number(worst.margin.toFixed(2)), element: worst.key, atMs: worst.atMs };
    if (worst.margin < 0) fail(`goes outside the viewBox by ${(-worst.margin).toFixed(2)} at ${worst.atMs}ms (${worst.key})`);
    for (const [i, entry] of overlaps.entries()) {
      entry.maxArea = Number(entry.maxArea.toFixed(2));
      if (entry.maxArea >= OVERLAP_MIN_AREA) {
        await play.page.evaluate((t) => window.__pz.seek(t), entry.atMs);
        fs.writeFileSync(path.join(options.out, `${candidate.id}-overlap-${i + 1}.png`), await play.page.locator('.host.hero').first().screenshot());
        report.warnings.push(`overlap ${entry.pair}: ${entry.maxArea} viewBox units^2 at ${entry.atMs}ms (${candidate.id}-overlap-${i + 1}.png); judge whether it is intended`);
      }
    }
    report.overlaps = overlaps;

    // One iteration for once / cut (the cut switch is intended), one iteration plus the wrap for seam.
    const scanFrom = loop ? Math.min(...timings.map((t) => t.delay)) : 0;
    const scanTo = candidate.playback === 'seam' ? reference.delay + reference.duration + SEAM_SCAN_PAST_MS : (loop ? reference.delay + reference.duration : windowEnd);
    const smooth = await play.page.evaluate(([from, to, step]) => window.__pz.smoothness(from, to, step), [scanFrom, scanTo, SMOOTH_STEP_MS]);
    smooth.sort((a, b) => b.worstJump - a.worstJump);
    report.smoothness = { stepMs: SMOOTH_STEP_MS, threshold: options.smoothThreshold, movingShapes: smooth.length, shapes: smooth };
    groupJumps(smooth.filter((entry) => entry.worstJump > options.smoothThreshold)).forEach((group) => {
      const worst = group[0];
      const others = group.slice(1, 4).map((entry) => entry.element);
      const span = group.map((entry) => entry.atMs);
      const at = Math.min(...span) === Math.max(...span) ? `${worst.atMs}ms` : `${Math.min(...span)}-${Math.max(...span)}ms`;
      const shapes = group.length === 1
        ? `${worst.worstJump} of peak (${worst.element})`
        : `${group.length} shapes at once, worst ${worst.worstJump} of peak (${worst.element}), also ${others.join(', ')}${group.length > 4 ? ', ...' : ''}; likely one cause`;
      report.warnings.push(`speed jump at ${at}: ${shapes}; a stutter unless it is an intended collision, appearance, or start`);
    });

    const live = await render(context, svg, { play: true, theme: 'light', themes: options.themes, deferred: true });
    const recordMs = candidate.playback === 'cut'
      ? reference.delay + reference.duration * options.cycles
      : report.delayMs + FLASH_MIN_RECORD_MS;
    const frames = await live.page.evaluate(([markup, ms]) => window.__pz.live(markup, ms), [svg, recordMs]);
    const flashes = delayFlashes(frames, startState, staticState);
    report.delayFlashes = flashes;
    flashes.forEach((flash) => fail(`static state shows during animation-delay (${flash.element}, frame ${flash.frame}); add animation-fill-mode backwards or both`));
    const startsAwayFromStatic = differences(startState, staticState).length > 0;
    const firstFrame = classify(frames[0].state, { S: staticState, P0: startState });
    report.firstFrame = firstFrame;
    if (candidate.playback !== 'seam' && startsAwayFromStatic && firstFrame === 'S') {
      fail(candidate.playback === 'cut'
        ? 'the first frame of the first play shows the static (payoff) pose; the switch is not at the cycle boundary, or the delay has no backwards fill'
        : 'the first frame of the play shows the static state although the start pose differs; the delay has no backwards fill');
    }
    if (candidate.playback === 'cut') {
      const { boundaries } = cutBoundaries(frames, { S: staticState, P0: startState });
      report.realFrames = { frames: frames.length, firstFrame, boundaries };
      if (!boundaries.length) fail('no cycle boundary was crossed while recording');
      for (const boundary of boundaries) {
        if (boundary.frameBefore !== 'S') fail(`frame before the switch at ${boundary.atMs}ms is not the static state (${boundary.frameBefore})`);
        if (boundary.intermediateFrames > 0) fail(`${boundary.intermediateFrames} in-between frame(s) around the switch at ${boundary.atMs}ms`);
        if (boundary.frameAfter !== 'P0') report.notes.push(`frame after the switch at ${boundary.atMs}ms is ${boundary.frameAfter}: motion starts without a start beat`);
      }
    }
    errors.push(...live.errors);
    if (options.filmstrip) report.filmstrip = await filmstrip(context, svg, candidate, report, options);
  }
  if (options.webkitBrowser) await observeWebkit(options.webkitBrowser, svg, candidate, options, report);
  else if (options.webkit) report.webkit = { available: false, reason: options.webkitReason };

  errors.push(...light.rest.errors, ...play.errors);
  report.errors = errors;
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  return report;
}

// Real-time screenshots of the 138px hero from the moment the SVG is inserted, over one cycle (cut: past
// the first switch), laid out in one image with the animation time of each frame.
async function filmstrip(context, svg, candidate, report, options) {
  const page = await render(context, svg, { play: true, theme: 'light', themes: options.themes, deferred: true });
  const recordMs = report.delayMs + report.periodMs + (candidate.playback === 'once' ? 300 : 600);
  await page.page.evaluate((markup) => document.querySelectorAll('.host').forEach((host) => { host.innerHTML = markup; }), svg);
  const hero = page.page.locator('.host.hero').nth(FILMSTRIP_HERO_INDEX);
  const frames = [];
  const started = Date.now();
  while (Date.now() - started < recordMs) {
    const before = Date.now();
    const time = await page.page.evaluate(() => { const first = document.querySelector('.host.hero').getAnimations({ subtree: true })[0]; return first ? first.currentTime || 0 : 0; });
    frames.push({ label: `${Math.round(time)}ms`, data: (await hero.screenshot()).toString('base64') });
    const wait = options.filmstripInterval - (Date.now() - before);
    if (wait > 0) await page.page.waitForTimeout(wait);
  }
  const sheet = await page.page.evaluate(async ([items, columns, background, color]) => {
    const images = await Promise.all(items.map((item) => new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.src = 'data:image/png;base64,' + item.data; })));
    const cellWidth = images[0].width; const cellHeight = images[0].height + 16;
    const canvas = document.createElement('canvas');
    canvas.width = cellWidth * Math.min(columns, images.length); canvas.height = cellHeight * Math.ceil(images.length / columns);
    const context = canvas.getContext('2d');
    context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color; context.font = '11px sans-serif';
    images.forEach((img, i) => {
      const x = (i % columns) * cellWidth; const y = Math.floor(i / columns) * cellHeight;
      context.drawImage(img, x, y);
      context.fillText(items[i].label, x + 4, y + img.height + 12);
    });
    return canvas.toDataURL('image/png').split(',')[1];
  }, [frames, FILMSTRIP_COLUMNS, options.themes.light.background, options.themes.light['muted-foreground']]);
  const file = path.join(options.out, `${candidate.id}-filmstrip.png`);
  fs.writeFileSync(file, Buffer.from(sheet, 'base64'));
  await page.page.close();
  return { frames: frames.length, size: HERO_SIZES[FILMSTRIP_HERO_INDEX], file: path.basename(file) };
}

// WebKit (the engine of Safari and the iOS app web view): static and end screenshots per theme, the end
// compared with the static state by computed style within WebKit, and page errors.
async function observeWebkit(browser, svg, candidate, options, report) {
  report.webkit = { available: true, themes: {} };
  try {
    const context = await browser.newContext({ viewport: { width: 420, height: 200 }, deviceScaleFactor: 1 });
    for (const theme of ['light', 'dark']) {
      const suffix = theme === 'light' ? '' : `-${theme}`;
      const rest = await render(context, svg, { play: false, theme, themes: options.themes });
      const staticState = await rest.page.evaluate(() => window.__pz.state());
      fs.writeFileSync(path.join(options.out, `${candidate.id}-webkit${suffix}-static.png`), await rest.page.locator('.host.hero').first().screenshot());
      const play = await render(context, svg, { play: true, theme, themes: options.themes });
      await play.page.evaluate((epsilon) => window.__pz.seekEach('end', epsilon), END_OFFSET_MS);
      const endDiff = differences(await play.page.evaluate(() => window.__pz.state()), staticState);
      fs.writeFileSync(path.join(options.out, `${candidate.id}-webkit${suffix}-end.png`), await play.page.locator('.host.hero').first().screenshot());
      const errors = [...rest.errors, ...play.errors];
      report.webkit.themes[theme] = { endVsStatic: endDiff, errors };
      if (endDiff.length) report.warnings.push(`webkit ${theme}: end differs from the static state: ${endDiff.slice(0, 3).join(' | ')}`);
      if (errors.length) report.failures.push(`webkit ${theme}: page errors: ${errors.join(' | ')}`);
    }
    await context.close();
  } catch (error) {
    report.webkit = { available: false, reason: String(error.message || error).split('\n')[0] };
  }
}

function printReport(report) {
  const lines = [`candidate: ${report.id} (${report.playback}, period ${report.periodMs}ms, delay ${report.delayMs}ms)`];
  for (const [theme, result] of Object.entries(report.themes)) {
    const parts = [`end vs static ${result.endVsStatic ? result.endVsStatic.length : '-'} difference(s)`];
    if (result.reducedMotion) parts.push(`reduced motion ${result.reducedMotion.animations} animation(s) / ${result.reducedMotion.differences.length} difference(s)`);
    if (result.endVsStaticPixels) parts.push(`end vs static pixels ${result.endVsStaticPixels.pixels} (${(result.endVsStaticPixels.ratio * 100).toFixed(2)}%), max channel diff ${result.endVsStaticPixels.max} (edges of animated layers rasterize differently; up to about 4% is expected, judge by computed style)`);
    lines.push(`  ${theme}: ${parts.join(', ')}`);
  }
  if (report.playback === 'cut') {
    lines.push(`  hold ${report.holdMs}ms, start beat ${report.startBeatMs}ms, still ratio ${report.stillRatio} (paused-time scan)`);
    if (report.realFrames) {
      lines.push(`  real frames ${report.realFrames.frames}, first frame ${report.realFrames.firstFrame} (hold / start beat in real frames read up to 2 frames short)`);
      report.realFrames.boundaries.forEach((b) => lines.push(`  switch @${b.atMs}ms: ${b.frameBefore} -> ${b.frameAfter}, in-between frames ${b.intermediateFrames}, hold ${b.holdMs}ms, start beat ${b.startBeatMs}ms`));
    }
  } else if (report.firstFrame) {
    lines.push(`  first frame ${report.firstFrame}`);
  }
  if (report.staticBounds) {
    const b = report.staticBounds;
    const parts = [`${b.width}x${b.height} centre (${b.centerX}, ${b.centerY}) bottom ${Number(bottom(b).toFixed(1))}`];
    if (b.vsBase) parts.push(`vs base centre ${b.vsBase.dx >= 0 ? '+' : ''}${b.vsBase.dx}, ${b.vsBase.dy >= 0 ? '+' : ''}${b.vsBase.dy} size x${b.vsBase.sizeRatio}`);
    if (b.vsOthers) parts.push(`size x${b.vsOthers.sizeRatioToMedian} of the median of ${b.vsOthers.games} other game(s) (their centre y ${b.vsOthers.centerYMedian}, bottom ${b.vsOthers.bottomMedian})`);
    lines.push(`  static bounds: ${parts.join(', ')}`);
  }
  if (report.ink) {
    const ink = report.ink;
    const parts = [`${(ink.coverage * 100).toFixed(1)}% at ${ink.listSize}px`];
    if (ink.vsBase != null) parts.push(`x${ink.vsBase} of base`);
    if (ink.othersMedian != null) parts.push(`x${ink.vsOthersMedian} of the other games' median ${(ink.othersMedian * 100).toFixed(1)}% (their range ${ink.othersRange.map((v) => (v * 100).toFixed(1) + '%').join('-')})`);
    lines.push(`  ink coverage: ${parts.join(', ')}`);
  }
  if (report.minViewBoxMargin) lines.push(`  min viewBox margin ${report.minViewBoxMargin.margin} at ${report.minViewBoxMargin.atMs}ms (${report.minViewBoxMargin.element})`);
  if (report.smoothness) {
    const top = report.smoothness.shapes[0];
    lines.push(`  smoothness (${report.smoothness.stepMs}ms scan, threshold ${report.smoothness.threshold}): ${report.smoothness.movingShapes} moving shape(s)` +
      (top ? `, worst jump ${top.worstJump} at ${top.atMs}ms (${top.element})` : ''));
  }
  if (report.filmstrip) lines.push(`  filmstrip: ${report.filmstrip.frames} real-time frame(s) at ${report.filmstrip.size}px -> ${report.filmstrip.file}`);
  if (report.webkit) {
    lines.push(report.webkit.available
      ? `  webkit: ${Object.entries(report.webkit.themes).map(([theme, r]) => `${theme} end vs static ${r.endVsStatic.length} difference(s)`).join(', ')}`
      : `  NOTE: WebKit was not checked (${report.webkit.reason}); record that Safari rendering is unverified`);
  }
  (report.overlaps || []).forEach((entry) => lines.push(`  overlap ${entry.pair}: ${entry.atMs == null ? 'none' : `max ${entry.maxArea} viewBox units^2 at ${entry.atMs}ms`}`));
  report.notes.forEach((note) => lines.push(`  NOTE: ${note}`));
  report.warnings.forEach((warning) => lines.push(`  WARN: ${warning}`));
  report.failures.forEach((failure) => lines.push(`  FAIL: ${failure}`));
  if (!report.failures.length) lines.push('  PASS');
  console.log(lines.join('\n'));
}

(async () => {
  const options = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(options.manifest);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  options.out = path.resolve(options.out || path.join(path.dirname(manifestPath), 'observe'));
  options.themes = loadThemes(options.globalsCss);
  fs.mkdirSync(options.out, { recursive: true });
  const candidates = manifest.candidates
    .filter((candidate) => !options.only.length || options.only.includes(candidate.id))
    .map((candidate) => ({ ...candidate, file: path.isAbsolute(candidate.file) ? candidate.file : path.join(path.dirname(manifestPath), candidate.file) }));
  const playwright = loadPlaywright();
  const browser = await playwright.chromium.launch();
  if (options.webkit) {
    try {
      options.webkitBrowser = await playwright.webkit.launch();
    } catch (error) {
      options.webkitReason = String(error.message || error).split('\n')[0];
    }
  }
  options.references = await referenceBounds(browser, manifest, manifestPath, options);
  const reports = [];
  for (const candidate of candidates) {
    if (!PLAYBACKS.has(candidate.playback)) {
      reports.push({ id: candidate.id, playback: candidate.playback, failures: ['playback must be once, cut, or seam'], warnings: [], notes: [] });
      console.log(`candidate: ${candidate.id}\n  FAIL: playback must be once, cut, or seam`);
      continue;
    }
    const report = await observe(browser, candidate, options);
    reports.push(report);
    printReport(report);
  }
  await browser.close();
  if (options.webkitBrowser) await options.webkitBrowser.close();
  fs.writeFileSync(path.join(options.out, 'observe-report.json'), JSON.stringify(reports, null, 1));
  console.log(`report: ${path.join(options.out, 'observe-report.json')}`);
  process.exit(reports.some((report) => report.failures.length) ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(2); });
