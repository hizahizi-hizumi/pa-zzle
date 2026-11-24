// 常駐ブラウザ。HTTP で1操作ずつ受け付ける。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIR = __dirname;
const LOG = path.join(DIR, 'browser-errors.log');
const PORT = Number(process.env.PORT || 7391);
let shotNo = 0;

function log(line) {
  fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${line}\n`);
}

(async () => {
  const browser = await chromium.launch();
  const vw = Number(process.env.VW || 1280);
  const vh = Number(process.env.VH || 800);
  const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => log(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') log(`console.error: ${m.text()}`);
  });

  const server = http.createServer(async (req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const cmd = JSON.parse(body || '{}');
        let out = 'ok';
        switch (cmd.op) {
          case 'goto':
            await page.goto(cmd.url, { waitUntil: 'networkidle' });
            break;
          case 'click':
            await page.mouse.click(cmd.x, cmd.y);
            break;
          case 'move':
            await page.mouse.move(cmd.x, cmd.y);
            break;
          case 'drag': {
            await page.mouse.move(cmd.x1, cmd.y1);
            await page.mouse.down();
            const steps = cmd.steps || 10;
            await page.mouse.move(cmd.x2, cmd.y2, { steps });
            await page.mouse.up();
            break;
          }
          case 'key':
            await page.keyboard.press(cmd.key);
            break;
          case 'type':
            await page.keyboard.type(cmd.text);
            break;
          case 'wheel':
            await page.mouse.move(cmd.x || 640, cmd.y || 400);
            await page.mouse.wheel(0, cmd.dy);
            break;
          case 'wait':
            await page.waitForTimeout(cmd.ms);
            break;
          case 'viewport':
            await page.setViewportSize({ width: cmd.w, height: cmd.h });
            break;
          case 'shot': {
            shotNo += 1;
            const name = `${String(shotNo).padStart(3, '0')}-${cmd.name || 'shot'}.png`;
            await page.screenshot({ path: path.join(DIR, 'shots', name), fullPage: !!cmd.full });
            out = path.join(DIR, 'shots', name);
            break;
          }
          case 'url':
            out = page.url();
            break;
          case 'close':
            await browser.close();
            res.end('closed');
            process.exit(0);
            return;
          default:
            out = `unknown op ${cmd.op}`;
        }
        if (cmd.after) await page.waitForTimeout(cmd.after);
        res.end(String(out));
      } catch (e) {
        res.statusCode = 500;
        res.end(`error: ${e.message}`);
      }
    });
  });
  server.listen(PORT, '127.0.0.1', () => {
    log(`driver started on ${PORT}`);
    console.log(`ready ${PORT}`);
  });
})();
