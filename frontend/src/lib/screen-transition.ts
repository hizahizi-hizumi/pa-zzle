import {
  MOTION_DURATION_MS,
  MOTION_EASING,
  prefersReducedMotion,
} from "@/lib/motion";
import "@/lib/screen-transition.css";

/**
 * 画面の行き来の動きの種類。
 * ホームは、壁に掛けた額で、額の中にはそのゲームの台紙（白紙のジグソー）とピクトグラムがある。額の中の台紙は、ゲームのホームの台紙と同じ並びで描いてある。
 * 1問は台紙の1ピースで、解き終えるとそのピースに評価の色が付き、台紙の元の場所へ戻る。
 * - `enter-game`: ホームの額に寄り、額の中の台紙がゲームのホームの台紙に重なって、ゲームのホームになる。
 * - `leave-game`: ゲームのホームの台紙から引き、台紙が額の中に収まって、ホームになる。
 * - `settle`: 解き終えた画面が、結果に添えたピースへ絞られて、結果になる。
 * - `return`: 結果のピースが台紙の元の場所へ戻り、ゲームのホームになる。
 * - `open`: 結果から次のプレイへ進む。
 * - `close`: 結果・プレイからホームへ戻る。
 */
export type ScreenTransitionKind =
  | "enter-game"
  | "leave-game"
  | "open"
  | "settle"
  | "return"
  | "close";

/** 行き来の間に、画面とは別に運ぶもの。運ぶものの姿と動きは、それを持つ側が決める。 */
export type ScreenTransitionCarrier = {
  /** 遷移元の画面で、行き来の前に済ませる動き。終わってから行き来する。 */
  before?: () => Promise<void> | void;
  /** 遷移先の画面を描いた後の動き。終わるまでを、行き来の動きの内とする。 */
  after?: () => Promise<void> | void;
};

type Screen = "home" | "game-home" | "play" | "result";

function screenOf(pathname: string): Screen | null {
  const path = pathname.replace(/\/+$/, "");
  if (path === "") return "home";
  if (/^\/puzzles\/[^/]+$/.test(path)) return "game-home";
  if (/^\/puzzles\/[^/]+\/play\/[^/]+$/.test(path)) return "play";
  if (/^\/puzzles\/[^/]+\/result\/[^/]+$/.test(path)) return "result";
  return null;
}

// ゲームのホームからプレイへは、台紙のピースが抜けて入る動きが別にあるので、ここでは動かさない。
// プレイからゲームのホームへ戻るときと、同じ画面の中の移動も動かさない。
const KINDS: Partial<
  Record<Screen, Partial<Record<Screen, ScreenTransitionKind>>>
> = {
  home: { "game-home": "enter-game" },
  "game-home": { home: "leave-game" },
  play: { result: "settle", home: "close" },
  result: { play: "open", "game-home": "return", home: "close" },
};

export function screenTransitionKind(
  fromPathname: string,
  toPathname: string,
): ScreenTransitionKind | null {
  const from = screenOf(fromPathname);
  const to = screenOf(toPathname);
  if (!from || !to) return null;
  return KINDS[from]?.[to] ?? null;
}

const KIND_ATTRIBUTE = "data-screen-transition";
const FRAME_SELECTOR = "[data-screen-frame]";
const CONTENT_SELECTOR = "[data-screen-content]";
// 遷移先を描き終えた後に付ける。遷移先の表示にだけ当てる動きを、遷移元の表示へ当てないために使う。
const ARRIVED_ATTRIBUTE = "data-screen-arrived";
/** 遷移先の描画が終わらないまま動きを待ち続けないための上限。 */
const COMMIT_TIMEOUT_MS = 1500;

// 開く動きは遷移元の額から、収まる動きは遷移先の額へ動かすので、額の位置を測る時機が種類で違う。
const MEASURES_FRAME_BEFORE: ReadonlySet<ScreenTransitionKind> = new Set([
  "enter-game",
  "open",
]);
// 遷移元の画面を手前に置いたまま額を閉じる種類。運ぶものが遷移元の表示の上を横切らないよう、運ばない表示は額が動く前に引く。
// 額を開く種類は、遷移先の画面が遷移元を覆っていくので、引くのを待たずに動き出す。
const LEAVES_CONTENT_FIRST: ReadonlySet<ScreenTransitionKind> = new Set([
  "leave-game",
]);

let isRunning = false;
const endWaiters = new Set<() => void>();

/** 画面の行き来の動きの途中か。行き来した先の画面が、重い描画を動きの後ろへ回すのに使う。 */
export function isScreenTransitionRunning(): boolean {
  return isRunning;
}

/**
 * 画面の行き来の動きが終わったら `onEnd` を呼ぶ。動いていなければすぐ呼ぶ。
 * 遷移先の画面が開いたときに始める演出を、行き来の動きと重ねずに続けて見せるために使う。
 * 戻り値は、呼ばれる前に待つのをやめる関数。
 */
export function afterScreenTransition(onEnd: () => void): () => void {
  if (!isRunning) {
    onEnd();
    return function cancelNothing() {};
  }
  endWaiters.add(onEnd);
  return function cancel() {
    endWaiters.delete(onEnd);
  };
}

/** 額の中の明るい面の上端と下端を、動きが読む CSS 変数に写す。額の無い画面では画面いっぱいとして扱う。 */
function measureFrame(): void {
  const frame = document.querySelector(FRAME_SELECTOR);
  const rect = frame?.getBoundingClientRect();
  const top = rect ? Math.max(rect.top, 0) : 0;
  const bottom = rect ? Math.max(window.innerHeight - rect.bottom, 0) : 0;
  const style = document.documentElement.style;
  style.setProperty("--screen-frame-top", `${top}px`);
  style.setProperty("--screen-frame-bottom", `${bottom}px`);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** 運ばない表示を引く。戻り値は、引いた表示を元に戻す関数。 */
async function leaveContent(): Promise<() => void> {
  const animations = Array.from(
    document.querySelectorAll(CONTENT_SELECTOR),
    (content) =>
      content.animate([{ opacity: 0 }], {
        duration: MOTION_DURATION_MS.normal,
        easing: MOTION_EASING.exit,
        fill: "forwards",
      }),
  );
  await Promise.allSettled(animations.map((animation) => animation.finished));
  return function restoreContent() {
    for (const animation of animations) animation.cancel();
  };
}

const MENU_SELECTOR = '[role="menu"]';
/** 開いているメニューが閉じるのを待つ上限。 */
const MENU_CLOSE_TIMEOUT_MS = 300;

// メニューの項目から起きた行き来では、閉じかけのメニューが遷移元の姿に写り込むので、閉じてから動かす。
async function menusClosed(): Promise<void> {
  const deadline = performance.now() + MENU_CLOSE_TIMEOUT_MS;
  while (
    document.querySelector(MENU_SELECTOR) !== null &&
    performance.now() < deadline
  ) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

const PRESS_EVENTS = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "touchstart",
  "touchend",
  "click",
] as const;
/** 飛ばした押下に続く操作を捨てる時間の上限。 */
const SKIP_PRESS_SWALLOW_MS = 500;

function swallow(event: Event) {
  event.stopPropagation();
  // touch のイベントは既定の動作を止められない形で届く。続く click を捨てるので、止めなくてよい。
  if (event.cancelable && !event.type.startsWith("touch")) {
    event.preventDefault();
  }
}

// 動きを飛ばした押下が、動きの下にある画面の操作として届かないよう、その押下が click になるまでを捨てる。
function swallowSkippingPress(): void {
  function stop() {
    for (const type of PRESS_EVENTS) {
      window.removeEventListener(type, swallow, true);
    }
    window.removeEventListener("click", stop, true);
  }
  for (const type of PRESS_EVENTS) {
    window.addEventListener(type, swallow, true);
  }
  window.addEventListener("click", stop, true);
  setTimeout(stop, SKIP_PRESS_SWALLOW_MS);
}

/**
 * 画面の行き来 `navigate` を、`kind` の動きで見せる。`carrier` は、画面とは別に運ぶものを動かす。
 * 動きを減らす設定、動きを使えない環境、ダイアログが開いている間は、動かさずに行き来する。
 * 動きの間に画面を押すかキーを押すと、最後の姿まで飛ばす。動きの途中に重ねて起きた行き来は受けない。
 */
export async function runScreenTransition(
  kind: ScreenTransitionKind,
  navigate: () => Promise<void> | void,
  carrier: ScreenTransitionCarrier = {},
): Promise<void> {
  if (isRunning) return;
  if (
    typeof document.startViewTransition !== "function" ||
    prefersReducedMotion() ||
    document.querySelector('[role="dialog"][data-state="open"]') !== null
  ) {
    await navigate();
    return;
  }

  isRunning = true;
  const root = document.documentElement;
  // 行き来を起こした操作のあと、動きが始まる前に画面が入れ替わる。その間の押下も、行き来した先の画面の操作として受けず、動きを飛ばす操作として受ける。
  let transition: ViewTransition | undefined;
  let skipsOnStart = false;
  function skip() {
    if (transition === undefined) {
      skipsOnStart = true;
    } else {
      transition.skipTransition();
    }
  }
  function skipByPress(event: Event) {
    swallow(event);
    swallowSkippingPress();
    skip();
  }
  // ブラウザやOSの操作に使う組み合わせのキーは、飛ばす操作として受けず、止めない。
  function skipByKey(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    swallow(event);
    skip();
  }
  function finish() {
    window.removeEventListener("pointerdown", skipByPress, true);
    window.removeEventListener("keydown", skipByKey, true);
    root.removeAttribute(KIND_ATTRIBUTE);
    root.removeAttribute(ARRIVED_ATTRIBUTE);
    isRunning = false;
    const waiters = Array.from(endWaiters);
    endWaiters.clear();
    for (const onEnd of waiters) onEnd();
  }
  window.addEventListener("pointerdown", skipByPress, true);
  window.addEventListener("keydown", skipByKey, true);

  let restoreContent: (() => void) | undefined;
  try {
    await menusClosed();
    root.setAttribute(KIND_ATTRIBUTE, kind);
    if (MEASURES_FRAME_BEFORE.has(kind)) measureFrame();
    await carrier.before?.();
    if (LEAVES_CONTENT_FIRST.has(kind)) restoreContent = await leaveContent();
  } catch (error) {
    // 行き来の前の動きに失敗しても、行き来そのものは止めない。
    finish();
    await navigate();
    throw error;
  }

  let carried: Promise<void> | void;
  transition = document.startViewTransition(async () => {
    await Promise.race([navigate(), wait(COMMIT_TIMEOUT_MS)]);
    restoreContent?.();
    carried = carrier.after?.();
    root.setAttribute(ARRIVED_ATTRIBUTE, "");
    if (!MEASURES_FRAME_BEFORE.has(kind)) measureFrame();
  });
  if (skipsOnStart) transition.skipTransition();
  void Promise.allSettled([
    transition.finished,
    transition.updateCallbackDone.then(() => carried),
  ]).then(finish);

  await transition.updateCallbackDone;
}

function resetForTest(): void {
  isRunning = false;
}

export const _private = { resetForTest };
