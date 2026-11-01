// playtest-driver.mjs
// 試遊のためにブラウザを開いたまま常駐し、HTTP で1操作ずつ受けて、操作のたびにビューポートを撮る。
// 1回の node 呼び出しごとにブラウザを開き直すと盤面の状態が消えるため、常駐させる。
//
// 端末: iphone は Playwright の devices['iPhone 13']（390×664 = Safari の表示領域相当、タッチ、isMobile）、
// pc は 1280×800。画像は scale: 'css'（画像の1px = CSS の1px）なので、画像から読んだ座標をそのまま tap に使える。
//
// 使い方:
//   起動（背景で）: node playtest-driver.mjs serve --url <アプリの URL> --device <iphone|pc> --out <画像の出力先> --port <ポート>
//   操作:           node playtest-driver.mjs send --port <ポート> <操作> [引数...]
//   （serve の起動直後の send は、つながるまで最長30秒待つ）
// 操作:
//   goto <パス>                 アプリの URL からのパスを開く
//   tap <x> <y>                 iphone はタッチのタップ、pc はクリック
//   swipe <x1> <y1> <x2> <y2>   iphone はタッチのドラッグ（CDP の Input.dispatchTouchEvent）、pc はマウスのドラッグ
//   scroll <dy>                 マウスホイールでページを縦にスクロールする
//   wait <ミリ秒>               待ってから撮る
//   shot                        撮るだけ
//   zoom <x> <y> <幅> <高さ> [倍率]  ビューポートの矩形を倍率（既定4、1〜8）で描き直して撮る。拡大画像の (px, py) は
//                               ビューポートの (x + px/倍率, y + py/倍率)。盤面は動かさない
//   quit                        ブラウザを閉じて常駐を終える
// 返す1行: <画像のパス> t=<起動からの秒数>s scrollY=<window.scrollY>（zoom は末尾に zoom=<倍率>x、quit は "quit"）
// ブラウザエラー: pageerror と console.error を <画像の出力先>/browser-errors.log に追記する。

import { appendFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";

const SETTLE_MILLISECONDS = 400;
const SWIPE_STEPS = 12;
const HOST = "127.0.0.1";
const SERVE_WAIT_MILLISECONDS = 30_000;
const SERVE_RETRY_MILLISECONDS = 300;
const DEFAULT_ZOOM = 4;
const MAX_ZOOM = 8;

// playwright はリポジトリの依存に無く、環境の全体インストール（NODE_PATH や /opt/node*/lib/node_modules）から読む。
function loadPlaywright() {
  const globalModuleDirectories = [
    ...(process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean),
    ...(existsSync("/opt") ? readdirSync("/opt", { withFileTypes: true }) : [])
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("node"))
      .map((entry) => path.join("/opt", entry.name, "lib", "node_modules")),
  ];
  for (const base of [import.meta.url, ...globalModuleDirectories.map((directory) => path.join(directory, "_"))]) {
    try {
      return createRequire(base)("playwright");
    } catch {}
  }
  console.error("ERROR: playwright が見つからない。NODE_PATH に playwright のある node_modules を指定する");
  process.exit(2);
}

function contextOptionsFor(device, devices) {
  if (device === "iphone") {
    const { defaultBrowserType: _webkitOnly, ...iphone13 } = devices["iPhone 13"];
    return iphone13;
  }
  if (device === "pc") return { viewport: { width: 1280, height: 800 } };
  console.error(`ERROR: --device は iphone か pc: ${device}`);
  process.exit(2);
}

function requireOptions(values, names) {
  for (const name of names) {
    if (!values[name]) {
      console.error(`ERROR: --${name} が必要`);
      process.exit(2);
    }
  }
}

async function serve(args) {
  const { values } = parseArgs({
    args,
    options: {
      url: { type: "string" },
      device: { type: "string" },
      out: { type: "string" },
      port: { type: "string" },
    },
  });
  requireOptions(values, ["url", "device", "out", "port"]);
  const { chromium, devices } = loadPlaywright();
  const baseUrl = values.url.replace(/\/$/, "");
  const isTouch = values.device === "iphone";
  mkdirSync(values.out, { recursive: true });
  const errorLog = path.join(values.out, "browser-errors.log");

  const browser = await chromium.launch();
  const context = await browser.newContext(contextOptionsFor(values.device, devices));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  page.on("pageerror", (error) => appendFileSync(errorLog, `pageerror: ${error.message}\n`));
  page.on("console", (message) => {
    if (message.type() === "error") appendFileSync(errorLog, `console.error: ${message.text()}\n`);
  });

  const startedAt = Date.now();
  let shotNumber = 0;

  async function touchSwipe(x1, y1, x2, y2) {
    const point = (x, y) => [{ x, y }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(x1, y1) });
    for (let step = 1; step <= SWIPE_STEPS; step++) {
      const ratio = step / SWIPE_STEPS;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: point(x1 + (x2 - x1) * ratio, y1 + (y2 - y1) * ratio),
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }

  async function mouseSwipe(x1, y1, x2, y2) {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: SWIPE_STEPS });
    await page.mouse.up();
  }

  // 縮小した画像を引き伸ばすのではなく、CDP の clip.scale でその倍率で描き直すので、細い線・重なり・境界が見える。
  // clip は文書の座標なので、ビューポートの座標にスクロール量を足す。
  function zoomClip(x, y, width, height, magnification = DEFAULT_ZOOM) {
    const [left, top, w, h, scale] = [x, y, width, height, magnification].map(Number);
    if (![left, top, w, h].every(Number.isFinite) || w <= 0 || h <= 0) {
      throw new Error("zoom は <x> <y> <幅> <高さ> [倍率] を数で受ける（幅・高さは正）");
    }
    if (!(scale >= 1 && scale <= MAX_ZOOM)) throw new Error(`倍率は 1〜${MAX_ZOOM}: ${magnification}`);
    return { x: left, y: top, width: w, height: h, scale };
  }

  async function zoomShot(file, clip) {
    const scrolled = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: { ...clip, x: clip.x + scrolled.x, y: clip.y + scrolled.y },
    });
    writeFileSync(file, Buffer.from(data, "base64"));
  }

  const operations = {
    goto: (pathname) => page.goto(baseUrl + pathname, { waitUntil: "networkidle" }),
    tap: (x, y) => (isTouch ? page.touchscreen.tap(Number(x), Number(y)) : page.mouse.click(Number(x), Number(y))),
    swipe: (...coordinates) => (isTouch ? touchSwipe : mouseSwipe)(...coordinates.map(Number)),
    scroll: (dy) => page.mouse.wheel(0, Number(dy)),
    wait: (milliseconds) => page.waitForTimeout(Math.max(0, Number(milliseconds) - SETTLE_MILLISECONDS)),
    shot: async () => {},
    zoom: async () => {},
  };

  async function run(name, operands) {
    const clip = name === "zoom" ? zoomClip(...operands) : null;
    await operations[name](...operands);
    await page.waitForTimeout(SETTLE_MILLISECONDS);
    shotNumber += 1;
    const file = path.join(values.out, `${String(shotNumber).padStart(3, "0")}-${name}.png`);
    if (clip) await zoomShot(file, clip);
    else await page.screenshot({ path: file, scale: "css" });
    const note = clip ? ` zoom=${clip.scale}x` : "";
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    const scrollY = await page.evaluate(() => window.scrollY);
    return `${file} t=${seconds}s scrollY=${scrollY}${note}`;
  }

  const server = createServer(async (request, response) => {
    const [name, ...operands] = JSON.parse(new URL(request.url, `http://${HOST}`).searchParams.get("op"));
    if (name === "quit") {
      response.end("quit\n");
      server.close();
      await browser.close();
      return;
    }
    if (!(name in operations)) {
      response.statusCode = 400;
      response.end(`ERROR: 不明な操作: ${name}（${Object.keys(operations).join(" / ")} / quit）\n`);
      return;
    }
    try {
      response.end(`${await run(name, operands)}\n`);
    } catch (error) {
      response.statusCode = 500;
      response.end(`ERROR: ${name}: ${error.message.split("\n")[0]}\n`);
    }
  });
  server.listen(Number(values.port), HOST, () => console.log(`serving ${values.device} on ${HOST}:${values.port}`));
}

async function send(args) {
  const { values, positionals } = parseArgs({ args, options: { port: { type: "string" } }, allowPositionals: true });
  requireOptions(values, ["port"]);
  if (positionals.length === 0) {
    console.error("ERROR: 操作が必要");
    process.exit(2);
  }
  const query = encodeURIComponent(JSON.stringify(positionals));
  const response = await fetchWhenServing(`http://${HOST}:${values.port}/?op=${query}`);
  process.stdout.write(await response.text());
  process.exit(response.ok ? 0 : 1);
}

// serve を背景で起動した直後は、ブラウザの起動が終わるまで接続できないので待ち直す。
async function fetchWhenServing(url) {
  const deadline = Date.now() + SERVE_WAIT_MILLISECONDS;
  for (;;) {
    try {
      return await fetch(url);
    } catch (error) {
      if (Date.now() > deadline) {
        console.error(`ERROR: driver に接続できない（serve を起動したか、ポートが合っているか）: ${error.cause?.code ?? error.message}`);
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, SERVE_RETRY_MILLISECONDS));
    }
  }
}

const [command, ...rest] = process.argv.slice(2);
if (command === "serve") await serve(rest);
else if (command === "send") await send(rest);
else {
  console.error("使い方: node playtest-driver.mjs serve --url <URL> --device <iphone|pc> --out <出力先> --port <ポート>");
  console.error("        node playtest-driver.mjs send --port <ポート> <goto|tap|swipe|scroll|wait|shot|zoom|quit> [引数...]");
  process.exit(2);
}
