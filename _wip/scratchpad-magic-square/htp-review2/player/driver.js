// Persistent Playwright driver. Commands via HTTP POST JSON to 127.0.0.1:47391
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIR = __dirname;
const LOG = path.join(DIR, 'browser-errors.log');
const ACT = path.join(DIR, 'actions.log');
let shotN = 0;

function log(file, msg) {
  fs.appendFileSync(file, `[${new Date().toISOString()}] ${msg}\n`);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  let page = await context.newPage();
  const attach = (p) => {
    p.on('pageerror', (e) => log(LOG, `pageerror: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') log(LOG, `console.error: ${m.text()}`); });
  };
  attach(page);

  const server = http.createServer(async (req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let out = {};
      try {
        const cmd = JSON.parse(body || '{}');
        log(ACT, JSON.stringify(cmd));
        switch (cmd.op) {
          case 'goto': await page.goto(cmd.url, { waitUntil: 'networkidle' }); break;
          case 'viewport': await page.setViewportSize({ width: cmd.w, height: cmd.h }); break;
          case 'click': await page.mouse.click(cmd.x, cmd.y); break;
          case 'dblclick': await page.mouse.dblclick(cmd.x, cmd.y); break;
          case 'move': await page.mouse.move(cmd.x, cmd.y); break;
          case 'drag': {
            await page.mouse.move(cmd.x1, cmd.y1);
            await page.mouse.down();
            const steps = cmd.steps || 10;
            await page.mouse.move(cmd.x2, cmd.y2, { steps });
            if (cmd.hold) await page.waitForTimeout(cmd.hold);
            await page.mouse.up();
            break;
          }
          case 'key': await page.keyboard.press(cmd.key); break;
          case 'type': await page.keyboard.type(cmd.text); break;
          case 'wheel': await page.mouse.move(cmd.x, cmd.y); await page.mouse.wheel(0, cmd.dy); break;
          case 'wait': await page.waitForTimeout(cmd.ms); break;
          case 'url': out.url = page.url(); break;
          case 'back': await page.goBack(); break;
          case 'quit': res.end('{"ok":true}'); await browser.close(); process.exit(0);
        }
        if (cmd.waitAfter) await page.waitForTimeout(cmd.waitAfter);
        if (cmd.shot) {
          shotN += 1;
          const name = `${String(shotN).padStart(3, '0')}-${cmd.shot}.png`;
          await page.screenshot({ path: path.join(DIR, name), fullPage: !!cmd.full });
          out.shot = path.join(DIR, name);
        }
        out.url = page.url();
        out.ok = true;
      } catch (e) {
        out.ok = false; out.error = String(e && e.message || e);
        log(ACT, `ERROR ${out.error}`);
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(out));
    });
  });
  server.listen(47391, '127.0.0.1', () => log(ACT, 'driver ready'));
})();
