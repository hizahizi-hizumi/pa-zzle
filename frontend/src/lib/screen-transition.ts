import { prefersReducedMotion } from "@/lib/motion";

/** 行き来の間に、画面とは別に運ぶもの。運ぶものの姿と動きは、それを持つ側が決める。 */
export type ScreenTransitionCarrier = {
  /** 遷移元の画面で、行き来の前に済ませる動き。終わってから行き来する。 */
  before?: () => Promise<void> | void;
  /** 遷移先の画面を描いた後の動き。終わるまでを、行き来の動きの内とする。 */
  after?: () => Promise<void> | void;
  /** 動きを飛ばされたとき。運んでいるものを、最後の姿にするか取り除いて、`after` をすぐ終える。 */
  skip?: () => void;
};

const KIND_ATTRIBUTE = "data-screen-transition";
// 遷移先を描き終えた後に付ける。遷移先の表示にだけ当てる動きを、遷移元の表示へ当てないために使う。
const ARRIVED_ATTRIBUTE = "data-screen-arrived";
/** 遷移先の描画が終わらないまま動きを待ち続けないための上限。 */
const COMMIT_TIMEOUT_MS = 1500;

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

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
 * 今、画面の行き来を動きで見せられるか。動きを使えない環境、動きを減らす設定、ダイアログが開いている間、別の行き来の動きの途中は見せられない。
 */
export function canRunScreenTransition(): boolean {
  return (
    !isRunning &&
    typeof document.startViewTransition === "function" &&
    !prefersReducedMotion() &&
    document.querySelector('[role="dialog"][data-state="open"]') === null
  );
}

/**
 * 画面の行き来 `navigate` を、`kind` の動きで見せる。`kind` は動きの間、ルート要素の `data-screen-transition` に載る。`carrier` は、画面とは別に運ぶものを動かす。
 * 動きを見せられないときは、動かさずに行き来する。ただし、動きの途中に重ねて起きた行き来は受けない。
 * 動きの間に画面を押すかキーを押すと、最後の姿まで飛ばす。
 */
export async function runScreenTransition(
  kind: string,
  navigate: () => Promise<void> | void,
  carrier: ScreenTransitionCarrier = {},
): Promise<void> {
  if (isRunning) return;
  if (!canRunScreenTransition()) {
    await navigate();
    return;
  }

  isRunning = true;
  const root = document.documentElement;
  // 行き来を起こした操作のあと、動きが始まる前に画面が入れ替わる。その間の押下も、行き来した先の画面の操作として受けず、動きを飛ばす操作として受ける。
  let transition: ViewTransition | undefined;
  let skipsOnStart = false;
  function skip() {
    carrier.skip?.();
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

  try {
    await menusClosed();
    root.setAttribute(KIND_ATTRIBUTE, kind);
    await carrier.before?.();
  } catch (error) {
    // 行き来の前の動きに失敗しても、行き来そのものは止めない。
    finish();
    await navigate();
    throw error;
  }

  let carried: Promise<void> | void;
  transition = document.startViewTransition(async () => {
    await Promise.race([navigate(), wait(COMMIT_TIMEOUT_MS)]);
    carried = carrier.after?.();
    root.setAttribute(ARRIVED_ATTRIBUTE, "");
  });
  // 動きが始まる前に飛ばすと `ready` が拒否される。動きの始まりは待たないので、拒否を受けて捨てる。
  transition.ready.catch(() => {});
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
