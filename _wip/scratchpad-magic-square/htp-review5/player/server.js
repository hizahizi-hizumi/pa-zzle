// Resident Playwright driver: keeps one browser open, accepts commands over HTTP.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIR = __dirname;
const PORT = 9377;
const LOG = path.join(DIR, 'browser-errors.log');
const ACTLOG = path.join(DIR, 'actions.log');

function log(file, line) {
  fs.appendFileSync(file, `[${new Date().toISOString()}] ${line}\n`);
}

(async () => {
  const browser = await chromium.launch();
  let context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  let page = await context.newPage();
  const attach = (p) => {
    p.on('pageerror', (e) => log(LOG, `pageerror: ${e.message}`));
    p.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') log(LOG, `console.${m.type()}: ${m.text()}`);
    });
  };
  attach(page);
  let shot = 0;

  const server = http.createServer(async (req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let cmds;
      try {
        cmds = JSON.parse(body);
        if (!Array.isArray(cmds)) cmds = [cmds];
      } catch (e) {
        res.end('bad json');
        return;
      }
      const out = [];
      try {
        for (const c of cmds) {
          log(ACTLOG, JSON.stringify(c));
          switch (c.op) {
            case 'goto':
              await page.goto(c.url, { waitUntil: 'networkidle' });
              break;
            case 'click':
              await page.mouse.click(c.x, c.y);
              break;
            case 'move':
              await page.mouse.move(c.x, c.y, { steps: c.steps || 1 });
              break;
            case 'down':
              await page.mouse.down();
              break;
            case 'up':
              await page.mouse.up();
              break;
            case 'drag': {
              await page.mouse.move(c.x1, c.y1);
              await page.mouse.down();
              await page.mouse.move(c.x2, c.y2, { steps: c.steps || 10 });
              await page.mouse.up();
              break;
            }
            case 'wheel':
              await page.mouse.wheel(c.dx || 0, c.dy || 0);
              break;
            case 'key':
              await page.keyboard.press(c.key);
              break;
            case 'type':
              await page.keyboard.type(c.text);
              break;
            case 'wait':
              await page.waitForTimeout(c.ms);
              break;
            case 'viewport':
              await page.setViewportSize({ width: c.w, height: c.h });
              break;
            case 'newmobile': {
              await context.close();
              context = await browser.newContext({
                viewport: { width: c.w || 390, height: c.h || 844 },
                deviceScaleFactor: 2,
                isMobile: true,
                hasTouch: true,
              });
              page = await context.newPage();
              attach(page);
              break;
            }
            case 'newdesktop': {
              await context.close();
              context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
              page = await context.newPage();
              attach(page);
              break;
            }
            case 'tap':
              await page.touchscreen.tap(c.x, c.y);
              break;
            case 'shot': {
              shot += 1;
              const name = `${String(shot).padStart(3, '0')}-${c.name || 'shot'}.png`;
              await page.screenshot({ path: path.join(DIR, name), fullPage: !!c.full });
              out.push(name);
              break;
            }
            case 'url':
              out.push(page.url());
              break;
            case 'quit':
              res.end('bye');
              await browser.close();
              process.exit(0);
          }
        }
        res.end(JSON.stringify(out));
      } catch (e) {
        res.end('ERROR ' + e.message + ' ' + JSON.stringify(out));
      }
    });
  });
  server.listen(PORT, '127.0.0.1', () => console.log('ready'));
})();
