// 常駐するブラウザ操作サーバー。HTTP で1操作ずつ命令を受け、毎回スクリーンショットを撮る。
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SHOTS = path.join(DIR, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const LOG = path.join(DIR, 'browser-errors.log');
const ACTLOG = path.join(DIR, 'actions.log');
let n = 0;

function log(file, line) {
  fs.appendFileSync(file, `[${new Date().toISOString()}] ${line}\n`);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    locale: 'ja-JP',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => log(LOG, `pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') log(LOG, `console.error: ${m.text()}`);
  });

  async function shot(label) {
    n += 1;
    const name = `${String(n).padStart(3, '0')}-${(label || 'shot').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}.png`;
    const p = path.join(SHOTS, name);
    await page.screenshot({ path: p });
    return p;
  }

  async function tap(x, y) {
    // タッチのタップ
    await page.touchscreen.tap(x, y);
  }

  async function swipe(x1, y1, x2, y2, steps = 12) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
    for (let i = 1; i <= steps; i++) {
      const x = x1 + ((x2 - x1) * i) / steps;
      const y = y1 + ((y2 - y1) * i) / steps;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }

  const server = http.createServer(async (req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let out = {};
      try {
        const cmd = JSON.parse(body || '{}');
        log(ACTLOG, JSON.stringify(cmd));
        const wait = cmd.wait ?? 700;
        switch (cmd.op) {
          case 'goto':
            await page.goto(cmd.url, { waitUntil: 'networkidle' });
            break;
          case 'tap':
            await tap(cmd.x, cmd.y);
            break;
          case 'tapText': {
            const loc = page.getByText(cmd.text, { exact: !!cmd.exact }).nth(cmd.nth || 0);
            const box = await loc.boundingBox();
            if (!box) throw new Error('not visible: ' + cmd.text);
            await tap(box.x + box.width / 2, box.y + box.height / 2);
            out.box = box;
            break;
          }
          case 'tapRole': {
            const loc = page.getByRole(cmd.role, { name: cmd.name, exact: !!cmd.exact }).nth(cmd.nth || 0);
            const box = await loc.boundingBox();
            if (!box) throw new Error('not visible: ' + cmd.name);
            await tap(box.x + box.width / 2, box.y + box.height / 2);
            out.box = box;
            break;
          }
          case 'swipe':
            await swipe(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.steps);
            break;
          case 'scroll':
            await page.mouse.wheel(0, cmd.dy || 300);
            break;
          case 'key':
            await page.keyboard.press(cmd.key);
            break;
          case 'wait':
            break;
          case 'text':
            // 画面に見えている文字（読み上げ用テキスト）だけを返す
            out.text = await page.evaluate(() => document.body.innerText);
            break;
          case 'buttons':
            // 見えているボタンの名前と位置（アクセシブルネーム）
            out.buttons = await page.evaluate(() =>
              [...document.querySelectorAll('button, [role=button], a')]
                .map((b) => {
                  const r = b.getBoundingClientRect();
                  return {
                    name: (b.getAttribute('aria-label') || b.innerText || '').trim().slice(0, 40),
                    x: Math.round(r.x + r.width / 2),
                    y: Math.round(r.y + r.height / 2),
                    w: Math.round(r.width),
                    h: Math.round(r.height),
                  };
                })
                .filter((b) => b.w > 0 && b.h > 0 && b.y > -50 && b.y < 720),
            );
            break;
          case 'url':
            out.url = page.url();
            break;
          default:
            throw new Error('unknown op ' + cmd.op);
        }
        await page.waitForTimeout(wait);
        if (cmd.op !== 'text' && cmd.op !== 'buttons' && cmd.op !== 'url' && !cmd.noshot) {
          out.shot = await shot(cmd.label || cmd.op);
        }
        out.ok = true;
      } catch (e) {
        out.ok = false;
        out.error = String(e && e.message);
        try {
          out.shot = await shot('error');
        } catch {}
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(out));
    });
  });
  server.listen(5399, '127.0.0.1', () => console.log('driver ready on 5399'));
})();
