import {
  PLAY_ENTRY_BOARD_SELECTOR,
  PLAY_FRAME_BOARD_SELECTOR,
} from "@/components/play-board-return";
import { prefersReducedMotion } from "@/lib/motion";
import { createMotionCopy } from "@/lib/motion-copy";

/** ゲームのホームの中身が、広がる盤面へ場を譲って薄れるまでの時間。薄れ終えたら、盤面の下でプレイ画面を開く。 */
const SCENE_FADE_MS = 120;
/** 盤面が、プレイ画面の盤面の所へ広がって着くまでの時間。 */
const RISE_MS = 440;
/** 着いた盤面が、同じ所に現れたプレイ画面の盤面の上で薄れて消えるまでの時間。 */
const DISSOLVE_MS = 90;
/** プレイ画面の盤面を測れるまで待つ時間の上限。これを過ぎたら、測らずに着く。 */
const LANDING_WAIT_MS = 200;
/** ゆっくり離れて速く近づき、止まる手前で減速する。 */
const RISE_EASING = "cubic-bezier(0.5, 0, 0.1, 1)";
/** 着く先を測り直したあと、動きを途切れさせずに着く。 */
const LANDING_EASING = "cubic-bezier(0.2, 0, 0.1, 1)";
/** プレイ画面の盤面を測れないうちに目指す、盤面の幅の上限（px）と、画面の幅・高さに対する比、中心の高さの比。 */
const PROVISIONAL_MAX_WIDTH = 560;
const PROVISIONAL_WIDTH_RATIO = 0.96;
const PROVISIONAL_HEIGHT_RATIO = 0.62;
const PROVISIONAL_CENTER_Y_RATIO = 0.46;

/**
 * プレイ画面が、ゲームのホームから入ってきたことを知るのに使う、ルート要素の属性。
 * 盤面が着くまでは `arriving` で、プレイ画面は中身を見せずに置く。着いたら `landed` で、中身を現す。
 */
const PLAY_ENTRY_ATTRIBUTE = "data-play-entry";

type ZukanPlayEntry = {
  /** これから遊ぶ問題の盤面を描いている枠。この枠の位置と大きさから広げる。 */
  board: HTMLElement;
  /** ゲームのホームの中身。盤面が広がる間に薄れさせる。 */
  scene: HTMLElement;
  /** プレイ画面を開く。ゲームのホームの中身が薄れ終えたときに一度だけ呼ぶ。 */
  onArrive: () => void;
  /** 盤面が消え終えたとき。プレイ画面を開けずにゲームのホームが残ったときに、もう一度始められるようにするのに使う。 */
  onFinished: () => void;
};

/** 描画の時刻が今より遅れていると見なす差（ms）。1コマの長さより長くとる。 */
const TIMELINE_LAG_LIMIT_MS = 24;

/** 今の描画の時刻が、長く止まっていた処理のために今より遅れているか。読める時刻が無い環境では遅れていないとする。 */
function isTimelineBehind(): boolean {
  const timelineTime = document.timeline?.currentTime;
  return (
    typeof timelineTime === "number" &&
    performance.now() - timelineTime > TIMELINE_LAG_LIMIT_MS
  );
}

type Box = { centerX: number; centerY: number; width: number };

function toBox({ left, top, width, height }: DOMRect): Box {
  return { centerX: left + width / 2, centerY: top + height / 2, width };
}

/** 拡縮と移動だけの変形。拡縮の中心は、変形する要素の中心。 */
type Placement = { x: number; y: number; scale: number };

function toTransform({ x, y, scale }: Placement): string {
  return `translate(${x}px, ${y}px) scale(${scale})`;
}

/** 枠の中に、広げる盤面が描かれているか。描かれていなければ、広げずに始める。 */
export function hasZukanPlayEntryBoard(frame: HTMLElement): boolean {
  return frame.querySelector(PLAY_ENTRY_BOARD_SELECTOR) !== null;
}

/**
 * 盤面の写しを、広がりきった大きさで、プレイ画面の盤面を測れないうちに目指す所に置く。
 * 広がっても線や文字がぼやけないよう、広がりきった大きさで描いて縮めたところから始める。
 * 写しは、ゲームのホームが消えても残るよう、body の直下に置く。
 */
function createRisenBoard(board: HTMLElement, size: number): HTMLElement {
  const risen = createMotionCopy(board, {
    left: window.innerWidth / 2 - size / 2,
    top: window.innerHeight * PROVISIONAL_CENTER_Y_RATIO - size / 2,
    width: size,
    height: size,
  });
  // 見せずに描いた盤面を元にしたときも、写しは見せる。
  Object.assign(risen.style, { opacity: "1", transformOrigin: "center" });
  return risen;
}

/**
 * 写しの中の盤面を、プレイ画面の盤面にぴったり重ねる変形。今の変形のもとで測った写しの盤面から求める。
 * 変形を読めない環境と、プレイ画面の盤面がまだ描かれていないときは `null`。
 */
function findLanding(risen: HTMLElement): Placement | null {
  const target = document.querySelector(PLAY_FRAME_BOARD_SELECTOR);
  if (target === null || typeof DOMMatrixReadOnly === "undefined") {
    return null;
  }
  const to = toBox(target.getBoundingClientRect());
  const current = new DOMMatrixReadOnly(getComputedStyle(risen).transform);
  const shown = toBox(
    (
      risen.querySelector(PLAY_ENTRY_BOARD_SELECTOR) ?? risen
    ).getBoundingClientRect(),
  );
  const frame = toBox(risen.getBoundingClientRect());
  if (to.width === 0 || shown.width === 0 || current.a === 0) {
    return null;
  }
  // 今の変形を外した、写しの枠の中心と、その中心から見た盤面の位置と幅。
  const restCenterX = frame.centerX - current.e;
  const restCenterY = frame.centerY - current.f;
  const boardWidth = shown.width / current.a;
  const boardOffsetX = (shown.centerX - frame.centerX) / current.a;
  const boardOffsetY = (shown.centerY - frame.centerY) / current.a;
  const scale = to.width / boardWidth;
  return {
    x: to.centerX - restCenterX - boardOffsetX * scale,
    y: to.centerY - restCenterY - boardOffsetY * scale,
    scale,
  };
}

/**
 * これから遊ぶ問題の盤面を、プレイ画面の盤面の所へ広げて重ね、そこでプレイ画面を現す。現したあと、広げた盤面は薄れて消える。
 * 見ていた盤面が、そのまま解く盤面になることを見せる。
 * 動きを減らす設定と、動かせない環境では、すぐにプレイ画面を開く。
 * 戻り値は、プレイ画面を開く前にやめる関数。盤面が広がる間にゲームのホームを離れたときに、離れた先からプレイ画面へ連れ戻さないために使う。
 * プレイ画面を開いたあとに呼んでも、何もしない。
 */
export function playZukanPlayEntry({
  board,
  scene,
  onArrive,
  onFinished,
}: ZukanPlayEntry): () => void {
  if (prefersReducedMotion() || typeof board.animate !== "function") {
    onArrive();
    onFinished();
    return function cancelNothing() {};
  }
  const size = Math.min(
    PROVISIONAL_MAX_WIDTH,
    window.innerWidth * PROVISIONAL_WIDTH_RATIO,
    window.innerHeight * PROVISIONAL_HEIGHT_RATIO,
  );
  const risen = createRisenBoard(board, size);
  const root = document.documentElement;
  // 盤面が覆っている間の押し直しを、下で開いたプレイ画面の盤面やゲームのホームへ届かせない。
  const shield = document.createElement("div");
  Object.assign(shield.style, {
    position: "fixed",
    inset: "0",
    zIndex: "var(--layer-overlay)",
  });
  document.body.append(shield);
  let hasArrived = false;
  let isFinished = false;
  let landingFrame = 0;

  function finish() {
    if (isFinished) {
      return;
    }
    isFinished = true;
    window.clearTimeout(arriveTimer);
    window.cancelAnimationFrame(landingFrame);
    risen.remove();
    shield.remove();
    root.removeAttribute(PLAY_ENTRY_ATTRIBUTE);
    // プレイ画面を開けずにゲームのホームが残ったときに、薄れたままにしない。
    sceneFade.cancel();
    board.style.opacity = "";
    onFinished();
  }

  /** 着いたら、同じ所にプレイ画面を現し、広げた盤面を薄れさせて消す。 */
  function dissolveAfterLanding(landing: Animation) {
    landing.finished.then(function dissolve() {
      if (isFinished) {
        return;
      }
      root.setAttribute(PLAY_ENTRY_ATTRIBUTE, "landed");
      risen
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: DISSOLVE_MS,
          easing: "linear",
          fill: "forwards",
        })
        .finished.then(finish, finish);
    }, finish);
  }

  const from = toBox(board.getBoundingClientRect());
  const start: Placement = {
    x: from.centerX - window.innerWidth / 2,
    y: from.centerY - window.innerHeight * PROVISIONAL_CENTER_Y_RATIO,
    scale: from.width / size,
  };
  document.body.append(risen);
  // 盤面の中に visibility を指定した要素があっても隠れるよう、不透明度で隠す。
  board.style.opacity = "0";
  const sceneFade = scene.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: SCENE_FADE_MS,
    easing: "linear",
    fill: "forwards",
  });
  let rise = risen.animate(
    [
      { transform: toTransform(start) },
      { transform: toTransform({ x: 0, y: 0, scale: 1 }) },
    ],
    { duration: RISE_MS, easing: RISE_EASING, fill: "forwards" },
  );
  const startedAt = performance.now();

  /** プレイ画面の盤面が描かれたら、今の動きから途切れさせずに、その盤面へ着くように目指す先を替える。 */
  function aimAtPlayBoard() {
    // プレイ画面を描く間に止まっていた描画の、遅れた時刻の姿を読んで動き直すと、画面の合成側で先へ進んでいた盤面が
    // 一度縮んで見える。遅れが無い次の描画まで待つ。
    if (isTimelineBehind()) {
      landingFrame = window.requestAnimationFrame(aimAtPlayBoard);
      return;
    }
    const landing = findLanding(risen);
    const elapsed = performance.now() - startedAt;
    if (landing === null) {
      if (elapsed < SCENE_FADE_MS + LANDING_WAIT_MS) {
        landingFrame = window.requestAnimationFrame(aimAtPlayBoard);
      } else {
        dissolveAfterLanding(rise);
      }
      return;
    }
    const current = getComputedStyle(risen).transform;
    rise.cancel();
    rise = risen.animate(
      [{ transform: current }, { transform: toTransform(landing) }],
      {
        duration: Math.max(RISE_MS - elapsed, DISSOLVE_MS),
        easing: LANDING_EASING,
        fill: "forwards",
      },
    );
    dissolveAfterLanding(rise);
  }

  const arriveTimer = window.setTimeout(function arrive() {
    hasArrived = true;
    root.setAttribute(PLAY_ENTRY_ATTRIBUTE, "arriving");
    onArrive();
    landingFrame = window.requestAnimationFrame(aimAtPlayBoard);
  }, SCENE_FADE_MS);

  return function cancel() {
    if (hasArrived) {
      return;
    }
    finish();
  };
}

export const _private = {
  PLAY_ENTRY_ATTRIBUTE,
  SCENE_FADE_MS,
};
