#!/usr/bin/env node
// Capture frame strips of showcase pictogram candidates for review.
//
// Each candidate is rendered on its own page (candidates share class names, so they must not share a
// document). The hero copies are paused at fixed times across one cycle and laid out in a row with the
// time under each frame, followed by the static pose at list size. One PNG per candidate and theme.
'use strict';

const fs = require('fs');
const path = require('path');
const { loadPlaywright } = require('./playwright_resolve.cjs');

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../..');
const USAGE = `usage: node capture_frames.cjs --manifest <manifest.json> --out <dir> [options]

Writes <out>/<candidate>-<theme>.png: hero frames paused every --step ms over one cycle, then the static pose.

options:
  --step <ms>        interval between frames (default 100)
  --from <ms>        first time to capture (default 0)
  --to <ms>          last time to capture (default: end of the cycle)
  --size <px>        hero size (default 177)
  --list-size <px>   static pose size (default 46)
  --themes <list>    comma-separated: light,dark (default both)
  --only <id>        capture one candidate (repeatable)
  --globals-css <f>  theme colors (default frontend/styles/globals.css)
  -h, --help         show this help`;

function parseArgs(argv) {
  const args = { step: 100, from: 0, to: null, size: 177, listSize: 46, themes: ['light', 'dark'], only: [],
    globalsCss: path.join(REPOSITORY_ROOT, 'frontend/styles/globals.css') };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new Error(`${flag} needs a value`); i += 1; return argv[i]; };
    if (flag === '-h' || flag === '--help') { console.log(USAGE); process.exit(0); }
    else if (flag === '--manifest') args.manifest = next();
    else if (flag === '--out') args.out = next();
    else if (flag === '--step') args.step = Number(next());
    else if (flag === '--from') args.from = Number(next());
    else if (flag === '--to') args.to = Number(next());
    else if (flag === '--size') args.size = Number(next());
    else if (flag === '--list-size') args.listSize = Number(next());
    else if (flag === '--themes') args.themes = next().split(',').map((t) => t.trim()).filter(Boolean);
    else if (flag === '--only') args.only.push(next());
    else if (flag === '--globals-css') args.globalsCss = next();
    else throw new Error(`unknown argument: ${flag}\n\n${USAGE}`);
  }
  if (!args.manifest || !args.out) throw new Error(USAGE);
  if (!(args.step > 0)) throw new Error('--step must be positive');
  return args;
}

function readThemeBlock(css, selector) {
  const match = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`no ${selector} block in globals.css`);
  return [...match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => `${m[1]}:${m[2].trim()}`).join(';');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(args.manifest);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const css = fs.readFileSync(args.globalsCss, 'utf8');
  const tokens = { light: readThemeBlock(css, ':root'), dark: readThemeBlock(css, '.dark') };
  fs.mkdirSync(args.out, { recursive: true });

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const written = [];
  try {
    for (const candidate of manifest.candidates) {
      if (args.only.length && !args.only.includes(candidate.id)) continue;
      const svg = fs.readFileSync(path.resolve(path.dirname(manifestPath), candidate.file), 'utf8');
      for (const theme of args.themes) {
        if (!tokens[theme]) throw new Error(`unknown theme: ${theme}`);
        const page = await browser.newPage({ deviceScaleFactor: 2 });
        const hostStyle = `${tokens[theme]};--game-pictogram-strong:var(--foreground);--game-pictogram-soft:var(--muted-foreground)`;
        await page.setContent(`<!DOCTYPE html><html class="${theme === 'dark' ? 'dark' : ''}" style="${hostStyle}">
<body style="margin:0;background:var(--background);color:var(--muted-foreground);font:11px system-ui,sans-serif">
<div id="probe" data-pictogram-motion="play" style="width:${args.size}px;height:${args.size}px;position:absolute;left:-9999px">${svg}</div>
</body></html>`);
        const cycle = await page.evaluate(() => {
          const timings = document.getAnimations().map((a) => a.effect.getComputedTiming());
          return timings.reduce((max, t) => Math.max(max, (t.delay || 0) + Number(t.duration || 0)), 0);
        });
        const to = args.to ?? Math.max(cycle - 1, 0);
        const times = [];
        for (let t = args.from; t <= to; t += args.step) times.push(Math.round(t));
        if (times[times.length - 1] !== to) times.push(to);
        const frames = times.map((t) => `<figure style="margin:0;text-align:center">
<div class="frame" data-pictogram-motion="play" data-t="${t}" style="width:${args.size}px;height:${args.size}px">${svg}</div>
<figcaption>${t}ms</figcaption></figure>`).join('');
        await page.evaluate(({ frames, title, listSize, svg }) => {
          document.getElementById('probe').remove();
          document.body.insertAdjacentHTML('beforeend', `<div style="padding:6px 8px">${title}</div>
<div style="display:flex;flex-wrap:wrap;gap:6px;padding:0 8px 8px;align-items:flex-end">${frames}
<figure style="margin:0;text-align:center"><div style="width:${listSize}px;height:${listSize}px">${svg}</div>
<figcaption>static ${listSize}px</figcaption></figure></div>`);
        }, { frames, title: escapeHtml(`${candidate.id} (${theme}, cycle ${Math.round(cycle)}ms)`), listSize: args.listSize, svg });
        await page.evaluate(() => {
          for (const animation of document.getAnimations()) {
            const host = animation.effect.target && animation.effect.target.closest('[data-t]');
            if (!host) continue;
            animation.pause();
            animation.currentTime = Number(host.dataset.t);
          }
        });
        await page.setViewportSize({ width: Math.min(8 + Math.min(times.length + 1, 8) * (args.size + 6), 1500), height: 400 });
        const file = path.join(args.out, `${candidate.id}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: true });
        written.push(file);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  for (const file of written) console.log(file);
}

main().catch((error) => { console.error(error.message || error); process.exit(1); });
