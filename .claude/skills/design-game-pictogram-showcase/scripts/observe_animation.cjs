#!/usr/bin/env node
// Observe showcase pictogram candidates in a real browser (Playwright Chromium) and report:
//   (a) the static state against the end (once), the hold before the switch (cut) or the seam (seam),
//       by computed style of every visible element
//   (b) for cut, real frames around each cycle boundary: the frame before / after the switch and the
//       number of in-between frames
//   (c) that the hero stays in the static state under prefers-reduced-motion: reduce
//   (d) how far any visible shape goes outside the 0 0 120 120 viewBox over one cycle
//   (e) pageerror / console.error
// Each candidate is rendered alone in its own page (never in a srcdoc iframe; see references/self-review.md).
//
// node observe_animation.cjs --manifest <manifest.json> [--only id,id] [--out <dir>] [--cycles 3.3] [--pixels]
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HERO_SIZES = [177, 138];
const LIST_SIZE = 50;
const THEME = { strong: 'oklch(0.145 0 0)', soft: 'oklch(0.556 0 0)', background: '#ffffff' };
const NUMBER_TOLERANCE = 0.01;
const END_OFFSET_MS = 0.01;
const OVERFLOW_STEP_MS = 20;
const HOLD_STEP_MS = 10;
const PIXEL_CHANNEL_THRESHOLD = 24;
const PLAYBACKS = new Set(['once', 'cut', 'seam']);

function parseArgs(argv) {
  const args = { cycles: 3.3, only: [], pixels: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--manifest') args.manifest = argv[++i];
    else if (flag === '--out') args.out = argv[++i];
    else if (flag === '--only') args.only = argv[++i].split(',').filter(Boolean);
    else if (flag === '--cycles') args.cycles = Number(argv[++i]);
    else if (flag === '--pixels') args.pixels = true;
    else throw new Error(`unknown argument: ${flag}`);
  }
  if (!args.manifest) throw new Error('usage: observe_animation.cjs --manifest <manifest.json> [--only id,id] [--out dir] [--cycles 3.3] [--pixels]');
  return args;
}

function hostPage(svg, play) {
  const motion = play ? ' data-pictogram-motion="play"' : '';
  const heroes = HERO_SIZES.map((size) => `<span class="host hero"${motion} style="width:${size}px;height:${size}px">${svg}</span>`).join('');
  return `<!doctype html><html><head><style>
html,body{margin:0;background:${THEME.background}}
body{display:flex;gap:8px;align-items:flex-start;padding:8px}
.host{display:block;--game-pictogram-strong:${THEME.strong};--game-pictogram-soft:${THEME.soft}}
.host>svg{display:block;width:100%;height:100%}
</style></head><body>${heroes}<span class="host list" style="width:${LIST_SIZE}px;height:${LIST_SIZE}px">${svg}</span></body></html>`;
}

// Runs in the page. Collects the computed style that decides how each element looks.
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
      return { key: index + ':' + el.localName + (el.getAttribute('class') ? '.' + el.getAttribute('class') : ''), visible: effectiveOpacity(el, svg) > 0.001, props };
    });
  };
  const animations = (host) => host ? host.getAnimations({ subtree: true }) : document.getAnimations();
  const cycle = () => animations().reduce((longest, animation) => {
    const timing = animation.effect.getComputedTiming();
    const iterations = Number.isFinite(timing.iterations) ? timing.iterations : 1;
    return Math.max(longest, (timing.delay || 0) + Number(timing.duration || 0) * iterations);
  }, 0);
  const seek = (time) => animations().forEach((animation) => { animation.pause(); animation.currentTime = time; });
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
      if (margin < worst.margin) worst = { margin, key: index + ':' + el.localName + (el.getAttribute('class') ? '.' + el.getAttribute('class') : '') };
    });
    return worst;
  };
  const record = (durationMs) => new Promise((resolve) => {
    const anim = animations(firstHero())[0];
    const frames = [];
    const start = performance.now();
    const tick = () => {
      frames.push({ time: anim ? anim.currentTime : null, state: state() });
      if (performance.now() - start < durationMs) requestAnimationFrame(tick); else resolve(frames);
    };
    requestAnimationFrame(tick);
  });
  return { state, cycle, seek, overflow, record, count: () => animations().length };
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

// Differences between two states; an element invisible in both is ignored (its transform or color
// does not show).
function differences(a, b) {
  const result = [];
  a.forEach((element, index) => {
    const other = b[index];
    if (!element.visible && !other.visible) return;
    if (element.visible !== other.visible) {
      result.push(`${element.key} visible ${element.visible} / ${other.visible}`);
      return;
    }
    for (const prop of Object.keys(element.props)) {
      if (!sameValue(prop, element.props[prop], other.props[prop])) {
        result.push(`${element.key} ${prop}: ${element.props[prop]} / ${other.props[prop]}`);
      }
    }
  });
  return result;
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

async function render(context, svg, play) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push('pageerror: ' + error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console.error: ' + message.text()); });
  await page.setContent(hostPage(svg, play));
  await page.addScriptTag({ content: IN_PAGE });
  return { page, errors };
}

function classify(state, references) {
  for (const [label, reference] of Object.entries(references)) {
    if (differences(state, reference).length === 0) return label;
  }
  return 'M';
}

// Reads the rAF record around every cycle boundary of a cut loop.
function cutBoundaries(frames, period, references) {
  const classes = frames.map((frame) => classify(frame.state, references));
  const boundaries = [];
  for (let i = 1; i < frames.length; i++) {
    if (Math.floor(frames[i - 1].time / period) === Math.floor(frames[i].time / period)) continue;
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

async function observe(browser, candidate, options) {
  const report = { id: candidate.id, playback: candidate.playback, failures: [], notes: [] };
  const fail = (message) => report.failures.push(message);
  const svg = fs.readFileSync(candidate.file, 'utf8');
  const context = await browser.newContext({ viewport: { width: 420, height: 200 }, deviceScaleFactor: 1 });

  const rest = await render(context, svg, false);
  const staticState = await rest.page.evaluate(() => window.__pz.state());
  const staticShot = await rest.page.locator('.host.hero').first().screenshot();
  fs.writeFileSync(path.join(options.out, `${candidate.id}-static.png`), staticShot);

  const play = await render(context, svg, true);
  const period = await play.page.evaluate(() => window.__pz.cycle());
  report.periodMs = Math.round(period);
  if (!period) fail('no running animation with the play attribute');
  const at = async (time) => { await play.page.evaluate((t) => window.__pz.seek(t), time); return play.page.evaluate(() => window.__pz.state()); };
  const shot = async (name) => {
    const buffer = await play.page.locator('.host.hero').first().screenshot();
    fs.writeFileSync(path.join(options.out, `${candidate.id}-${name}.png`), buffer);
    return buffer;
  };

  if (period) {
    const startState = await at(0);
    await shot('start');
    const endState = await at(period - END_OFFSET_MS);
    const endShot = await shot('end');
    const endDiff = differences(endState, staticState);
    const label = { once: 'end', cut: 'hold (100%)', seam: 'seam (100%)' }[candidate.playback];
    report.endVsStatic = endDiff;
    if (endDiff.length) fail(`${label} differs from the static state: ${endDiff.slice(0, 5).join(' | ')}`);
    if (candidate.playback === 'seam') {
      const startDiff = differences(startState, staticState);
      report.startVsStatic = startDiff;
      if (startDiff.length) fail(`seam (0%) differs from the static state: ${startDiff.slice(0, 5).join(' | ')}`);
    }
    if (candidate.playback === 'cut') {
      if (differences(startState, staticState).length === 0) {
        fail('0% equals the static state: a cut loop starts from a different pose; if 0% = 100% declare seam');
      }
      let holdStart = period - END_OFFSET_MS;
      for (let time = period - END_OFFSET_MS; time >= 0; time -= HOLD_STEP_MS) {
        if (differences(await at(time), staticState).length) break;
        holdStart = time;
      }
      report.holdMs = Math.round(period - holdStart);
      let beatEnd = 0;
      for (let time = 0; time < period; time += HOLD_STEP_MS) {
        if (differences(await at(time), startState).length) break;
        beatEnd = time;
      }
      report.startBeatMs = beatEnd;
      report.stillRatio = Number(((report.holdMs + report.startBeatMs) / period).toFixed(3));
    }
    if (options.pixels) {
      report.endVsStaticPixels = await pixelDifference(play.page, endShot, staticShot);
    }

    let worst = { margin: Infinity, key: null, atMs: 0 };
    for (let time = 0; time < period; time += OVERFLOW_STEP_MS) {
      await play.page.evaluate((t) => window.__pz.seek(t), time);
      const sample = await play.page.evaluate(() => window.__pz.overflow());
      if (sample.margin < worst.margin) worst = { ...sample, atMs: time };
    }
    report.minViewBoxMargin = { margin: Number(worst.margin.toFixed(2)), element: worst.key, atMs: worst.atMs };
    if (worst.margin < 0) fail(`goes outside the viewBox by ${(-worst.margin).toFixed(2)} at ${worst.atMs}ms (${worst.key})`);

    if (candidate.playback === 'cut') {
      const live = await render(context, svg, true);
      const frames = await live.page.evaluate((ms) => window.__pz.record(ms), period * options.cycles);
      const { boundaries, firstFrame } = cutBoundaries(frames, period, { S: staticState, P0: startState });
      report.realFrames = { frames: frames.length, firstFrame, boundaries };
      if (firstFrame === 'S') fail('the first frame of the first play shows the static (payoff) pose; the switch is not at the cycle boundary');
      if (!boundaries.length) fail('no cycle boundary was crossed while recording');
      for (const boundary of boundaries) {
        if (boundary.frameBefore !== 'S') fail(`frame before the switch at ${boundary.atMs}ms is not the static state (${boundary.frameBefore})`);
        if (boundary.intermediateFrames > 0) fail(`${boundary.intermediateFrames} in-between frame(s) around the switch at ${boundary.atMs}ms`);
        if (boundary.frameAfter !== 'P0') report.notes.push(`frame after the switch at ${boundary.atMs}ms is ${boundary.frameAfter}: motion starts without a start beat`);
      }
      report.errors = live.errors;
    }
  }

  const reduced = await browser.newContext({ viewport: { width: 420, height: 200 }, reducedMotion: 'reduce' });
  const reducedPage = await render(reduced, svg, true);
  const reducedCount = await reducedPage.page.evaluate(() => window.__pz.count());
  const reducedDiff = differences(await reducedPage.page.evaluate(() => window.__pz.state()), staticState);
  report.reducedMotion = { animations: reducedCount, differences: reducedDiff };
  if (reducedCount || reducedDiff.length) fail(`reduced motion is not the static state: ${reducedCount} animation(s), ${reducedDiff.length} difference(s)`);

  report.errors = [...(report.errors || []), ...rest.errors, ...play.errors, ...reducedPage.errors];
  if (report.errors.length) fail(`page errors: ${report.errors.join(' | ')}`);
  await reduced.close();
  await context.close();
  return report;
}

function printReport(report) {
  const lines = [`candidate: ${report.id} (${report.playback}, period ${report.periodMs}ms)`];
  if (report.playback === 'cut') {
    lines.push(`  hold ${report.holdMs}ms, start beat ${report.startBeatMs}ms, still ratio ${report.stillRatio}`);
    if (report.realFrames) {
      lines.push(`  real frames ${report.realFrames.frames}, first frame ${report.realFrames.firstFrame}`);
      report.realFrames.boundaries.forEach((b) => lines.push(`  switch @${b.atMs}ms: ${b.frameBefore} -> ${b.frameAfter}, in-between frames ${b.intermediateFrames}, hold ${b.holdMs}ms, start beat ${b.startBeatMs}ms`));
    }
  }
  if (report.endVsStaticPixels) {
    const p = report.endVsStaticPixels;
    lines.push(`  end vs static pixels: ${p.pixels} (${(p.ratio * 100).toFixed(2)}%), max channel diff ${p.max}`);
  }
  lines.push(`  min viewBox margin ${report.minViewBoxMargin ? `${report.minViewBoxMargin.margin} at ${report.minViewBoxMargin.atMs}ms (${report.minViewBoxMargin.element})` : '-'}`);
  lines.push(`  reduced motion: ${report.reducedMotion.animations} animation(s), ${report.reducedMotion.differences.length} difference(s)`);
  report.notes.forEach((note) => lines.push(`  NOTE: ${note}`));
  report.failures.forEach((failure) => lines.push(`  FAIL: ${failure}`));
  if (!report.failures.length) lines.push('  PASS');
  console.log(lines.join('\n'));
}

(async () => {
  const options = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(options.manifest);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  options.out = path.resolve(options.out || path.join(path.dirname(manifestPath), 'observe'));
  fs.mkdirSync(options.out, { recursive: true });
  const candidates = manifest.candidates
    .filter((candidate) => !options.only.length || options.only.includes(candidate.id))
    .map((candidate) => ({ ...candidate, file: path.isAbsolute(candidate.file) ? candidate.file : path.join(path.dirname(manifestPath), candidate.file) }));
  const browser = await chromium.launch();
  const reports = [];
  for (const candidate of candidates) {
    if (!PLAYBACKS.has(candidate.playback)) {
      reports.push({ id: candidate.id, playback: candidate.playback, failures: ['playback must be once, cut, or seam'], notes: [] });
      console.log(`candidate: ${candidate.id}\n  FAIL: playback must be once, cut, or seam`);
      continue;
    }
    const report = await observe(browser, candidate, options);
    reports.push(report);
    printReport(report);
  }
  await browser.close();
  fs.writeFileSync(path.join(options.out, 'observe-report.json'), JSON.stringify(reports, null, 1));
  console.log(`report: ${path.join(options.out, 'observe-report.json')}`);
  process.exit(reports.some((report) => report.failures.length) ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(2); });
