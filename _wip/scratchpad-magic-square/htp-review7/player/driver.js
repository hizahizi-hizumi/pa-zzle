// 常駐ブラウザ。HTTP で1操作ずつ受け取る。
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const LOG = path.join(DIR, 'browser-errors.log');
const PORT = 47391;
let shotN = 0;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  let page = await context.newPage();
  const attach = (p) => {
    p.on('pageerror', (e) => fs.appendFileSync(LOG, `[pageerror] ${new Date().toISOString()} ${e.message}\n`));
    p.on('console', (m) => { if (m.type() === 'error') fs.appendFileSync(LOG, `[console.error] ${new Date().toISOString()} ${m.text()}\n`); });
  };
  attach(page);
  fs.appendFileSync(LOG, `--- driver start ${new Date().toISOString()}\n`);

  const server = http.createServer(async (req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let out = {};
      try {
        const cmd = JSON.parse(body || '{}');
        switch (cmd.op) {
          case 'goto': await page.goto(cmd.url, { waitUntil: 'networkidle' }); break;
          case 'viewport': await page.setViewportSize({ width: cmd.w, height: cmd.h }); break;
          case 'click': await page.mouse.click(cmd.x, cmd.y); break;
          case 'move': await page.mouse.move(cmd.x, cmd.y, { steps: cmd.steps || 1 }); break;
          case 'down': await page.mouse.down(); break;
          case 'up': await page.mouse.up(); break;
          case 'drag': {
            await page.mouse.move(cmd.x1, cmd.y1);
            await page.mouse.down();
            await page.mouse.move(cmd.x2, cmd.y2, { steps: cmd.steps || 10 });
            await page.mouse.up();
            break;
          }
          case 'key': await page.keyboard.press(cmd.key); break;
          case 'type': await page.keyboard.type(cmd.text); break;
          case 'wheel': await page.mouse.wheel(cmd.dx || 0, cmd.dy || 0); break;
          case 'wait': await page.waitForTimeout(cmd.ms); break;
          case 'url': out.url = page.url(); break;
          case 'back': await page.goBack(); break;
          case 'quit': res.end('{"ok":true}'); await browser.close(); process.exit(0);
        }
        if (cmd.wait) await page.waitForTimeout(cmd.wait);
        if (cmd.shot) {
          shotN++;
          const f = path.join(DIR, `${String(shotN).padStart(3, '0')}-${cmd.shot}.png`);
          await page.screenshot({ path: f, fullPage: !!cmd.full });
          out.shot = f;
        }
        out.ok = true;
        out.url = page.url();
      } catch (e) {
        out.ok = false; out.error = String(e);
      }
      res.end(JSON.stringify(out));
    });
  });
  server.listen(PORT, '127.0.0.1', () => console.log('driver ready on ' + PORT));
})();
