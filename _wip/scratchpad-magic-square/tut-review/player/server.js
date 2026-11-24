// Persistent browser that accepts commands over HTTP.
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const DIR = __dirname;
const PORT = 7811;
let browser, context, page;
let shotNo = 0;
const consoleErrors = [];

async function start() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
}

async function shot(name) {
  shotNo += 1;
  const file = path.join(DIR, `${String(shotNo).padStart(3, '0')}-${name || 'shot'}.png`);
  await page.screenshot({ path: file });
  return file;
}

async function handle(cmd) {
  const out = {};
  switch (cmd.op) {
    case 'goto':
      await page.goto(cmd.url, { waitUntil: 'networkidle' });
      break;
    case 'tap':
      await page.touchscreen.tap(cmd.x, cmd.y);
      break;
    case 'drag': {
      // touch drag via CDP
      const cdp = await context.newCDPSession(page);
      const steps = cmd.steps || 10;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cmd.x1, y: cmd.y1 }] });
      for (let i = 1; i <= steps; i++) {
        const x = cmd.x1 + ((cmd.x2 - cmd.x1) * i) / steps;
        const y = cmd.y1 + ((cmd.y2 - cmd.y1) * i) / steps;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
        await new Promise((r) => setTimeout(r, 16));
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
      break;
    }
    case 'longpress': {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cmd.x, y: cmd.y }] });
      await new Promise((r) => setTimeout(r, cmd.ms || 700));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
      break;
    }
    case 'scroll':
      await page.mouse.wheel(0, cmd.dy || 300);
      break;
    case 'swipe': {
      const cdp = await context.newCDPSession(page);
      const steps = 8;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cmd.x1, y: cmd.y1 }] });
      for (let i = 1; i <= steps; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cmd.x1 + ((cmd.x2 - cmd.x1) * i) / steps, y: cmd.y1 + ((cmd.y2 - cmd.y1) * i) / steps }] });
        await new Promise((r) => setTimeout(r, 12));
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
      break;
    }
    case 'text':
      out.text = await page.evaluate(() => document.body.innerText);
      break;
    case 'clickables':
      out.items = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('button, a, [role=button], [role=tab], [role=gridcell], [role=link]'));
        return els.map((e) => {
          const r = e.getBoundingClientRect();
          return { tag: e.tagName, label: (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 60), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height), disabled: e.disabled || e.getAttribute('aria-disabled') === 'true' };
        }).filter((i) => i.w > 0 && i.h > 0);
      });
      break;
    case 'url':
      out.url = page.url();
      break;
    case 'errors':
      out.errors = consoleErrors.slice();
      break;
    case 'wait':
      await page.waitForTimeout(cmd.ms || 500);
      break;
    case 'close':
      await browser.close();
      setTimeout(() => process.exit(0), 100);
      break;
    default:
      throw new Error('unknown op ' + cmd.op);
  }
  if (cmd.wait) await page.waitForTimeout(cmd.wait);
  if (cmd.shot !== false && cmd.op !== 'text' && cmd.op !== 'clickables' && cmd.op !== 'url' && cmd.op !== 'errors' && cmd.op !== 'close') {
    out.shot = await shot(cmd.name);
  }
  return out;
}

start().then(() => {
  http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const cmds = JSON.parse(body);
        const results = [];
        for (const c of Array.isArray(cmds) ? cmds : [cmds]) results.push(await handle(c));
        res.end(JSON.stringify(results, null, 1));
      } catch (e) {
        res.statusCode = 500;
        res.end(String(e && e.stack));
      }
    });
  }).listen(PORT, '127.0.0.1', () => console.log('ready ' + PORT));
});
