#!/usr/bin/env node
// Open a gallery made by make_review_gallery.py in Chromium, like a phone or a desktop browser, and report
// what breaks the page: pageerror / console.error, horizontal overflow, <img> SVGs that fail to load
// (human), hero <img> SVGs that do not change over time (human: every candidate loops), and preview iframes
// whose height does not fit their content (self). Saves a full-page screenshot.
'use strict';

const fs = require('fs');
const path = require('path');
const { loadPlaywright } = require('./playwright_resolve.cjs');

const USAGE = `usage: node check_gallery.cjs <gallery.html> [options]
  --out <dir>        screenshots (default: next to the gallery)
  --device <name>    Playwright device to emulate, e.g. "iPhone 13" (default: desktop 1280x900)
  --dark             human gallery: switch to the dark theme before the screenshot
  --wait <ms>        time to let the pictograms play before the screenshot (default 1500)
  --motion-window <ms>
                     human gallery: how long each visible hero <img> is watched for a change
                     (default 7000, longer than one cycle; 0 skips the check)
  -h, --help         show this help`;
const IFRAME_FIT_TOLERANCE_PX = 4;
const MOTION_FRAME_INTERVAL_MS = 250;

function parseArgs(argv) {
  const args = { device: null, dark: false, wait: 1500, motionWindow: 7000 };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '-h' || flag === '--help') { console.log(USAGE); process.exit(0); }
    else if (flag === '--out') args.out = argv[++i];
    else if (flag === '--device') args.device = argv[++i];
    else if (flag === '--dark') args.dark = true;
    else if (flag === '--wait') args.wait = Number(argv[++i]);
    else if (flag === '--motion-window') args.motionWindow = Number(argv[++i]);
    else if (flag.startsWith('-')) throw new Error(`unknown argument: ${flag}\n${USAGE}`);
    else args.gallery = flag;
  }
  if (!args.gallery) throw new Error(USAGE);
  return args;
}

// Screenshots every visible hero <img> repeatedly and returns those that never differ from their first
// screenshot within the window. A hero is dropped from the watch as soon as it changes.
async function stillHeroes(page, windowMs) {
  const heroes = [];
  for (const handle of await page.$$('img[data-view="hero"]')) {
    if (await handle.isVisible()) heroes.push({ handle, ...(await handle.evaluate((img) => ({ candidate: img.dataset.candidate || '(no data-candidate)', theme: img.dataset.theme }))) });
  }
  const first = new Map();
  let watching = heroes;
  const started = Date.now();
  while (watching.length && Date.now() - started < windowMs) {
    const next = [];
    for (const hero of watching) {
      const shot = (await hero.handle.screenshot()).toString('base64');
      if (!first.has(hero)) first.set(hero, shot);
      if (shot === first.get(hero)) next.push(hero);
    }
    watching = next;
    await page.waitForTimeout(MOTION_FRAME_INTERVAL_MS);
  }
  return watching.map(({ candidate, theme }) => ({ candidate, theme }));
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const gallery = path.resolve(args.gallery);
  const out = path.resolve(args.out || path.dirname(gallery));
  fs.mkdirSync(out, { recursive: true });
  const { chromium, devices } = loadPlaywright();
  if (args.device && !devices[args.device]) throw new Error(`unknown device: ${args.device}`);
  const browser = await chromium.launch();
  const context = await browser.newContext(args.device ? devices[args.device] : { viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push('pageerror: ' + error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console.error: ' + message.text()); });
  await page.goto('file://' + gallery);
  if (args.dark) {
    const toggle = page.locator('#theme');
    if (await toggle.count()) await toggle.click();
  }
  await page.waitForTimeout(args.wait);

  const result = await page.evaluate((tolerance) => {
    const overflowPx = document.documentElement.scrollWidth - window.innerWidth;
    const images = [...document.querySelectorAll('img[data-view]')]
      .filter((img) => img.offsetParent !== null)
      .map((img) => ({ view: img.dataset.view, theme: img.dataset.theme, width: img.getBoundingClientRect().width, loaded: img.complete && img.naturalWidth > 0 }));
    const frames = [...document.querySelectorAll('iframe.preview')].map((frame) => {
      const body = frame.contentDocument && frame.contentDocument.body;
      const content = body ? Math.ceil(body.getBoundingClientRect().height) : null;
      const height = Math.round(frame.getBoundingClientRect().height);
      return { title: frame.title, height, content, fits: content != null && Math.abs(height - content) <= tolerance };
    });
    return { overflowPx, images, frames };
  }, IFRAME_FIT_TOLERANCE_PX);

  const still = args.motionWindow > 0 ? await stillHeroes(page, args.motionWindow) : [];

  const label = (args.device || 'desktop').replace(/\W+/g, '-').toLowerCase() + (args.dark ? '-dark' : '');
  const shot = path.join(out, `${path.basename(gallery, '.html')}-${label}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  await browser.close();

  const failures = [...errors];
  if (result.overflowPx > 1) failures.push(`page overflows horizontally by ${result.overflowPx}px`);
  result.images.filter((image) => !image.loaded).forEach((image) => failures.push(`<img> ${image.view} (${image.theme}) did not load`));
  still.forEach((hero) => failures.push(`hero <img> of ${hero.candidate} (${hero.theme}) did not change in ${args.motionWindow}ms; it does not animate`));
  result.frames.filter((frame) => !frame.fits).forEach((frame) => failures.push(`iframe "${frame.title}" is ${frame.height}px for ${frame.content}px of content`));

  const heroWidths = [...new Set(result.images.filter((image) => image.view === 'hero').map((image) => image.width))];
  console.log(`gallery: ${gallery} (${label})`);
  if (result.images.length) console.log(`  images ${result.images.length} visible, hero width ${heroWidths.join(', ')}px`);
  if (heroWidths.length && args.motionWindow > 0) console.log(`  hero motion: ${result.images.filter((image) => image.view === 'hero').length - still.length} changing, ${still.length} still within ${args.motionWindow}ms`);
  if (result.frames.length) console.log(`  iframes ${result.frames.length}: ${result.frames.map((frame) => `${frame.height}/${frame.content}px`).join(', ')}`);
  console.log(`  screenshot: ${shot}`);
  failures.forEach((failure) => console.log(`  FAIL: ${failure}`));
  if (!failures.length) console.log('  PASS');
  process.exit(failures.length ? 1 : 0);
})().catch((error) => { console.error(error.message || error); process.exit(2); });
