import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";
import { ZUKAN_PIECE_VIEW_BOX } from "@/zukan/ui/GameHomeScreen/zukan-piece-shape";
import { readZukanSheetView } from "@/zukan/ui/GameHomeScreen/zukan-sheet-view";
import { rememberZukanPlayPiece } from "@/zukan/ui/zukan-piece-transit";

/** 台紙から抜いたピースがプレイへ入るまでの、それぞれの動きの長さ（ms）。 */
const ZUKAN_PLAY_ENTRY_DURATION_MS = {
  /** 台紙を送って、抜くピースを見える所へ運ぶ。 */
  spin: 360,
  /** ピースを台紙から抜き、画面の中央へ大きく運ぶ。同時に、ほかの表示を引く。 */
  lift: 340,
  /** プレイ画面の上で、ピースを広げながら消す。 */
  dissolve: 240,
} as const;

/** 画面の中央へ運んだピースの1辺（px）と、消すときに広げる倍率。 */
const LIFTED_PIECE_SIZE_PX = 104;
const DISSOLVE_SCALE = 1.5;

/** 飛ばした押下の続きのクリックを待って捨てる長さ（ms）。 */
const SKIP_CLICK_SWALLOW_MS = 500;

/** 単独で押しても、飛ばす操作として受けないキー。 */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

type ZukanPlayEntryControl = { skip: () => void; cancel: () => void };

export type ZukanPlayEntry = {
  /** 抜くピースのマス。台紙のスクロール領域の中にある。 */
  square: HTMLElement;
  /** 台紙のスクロール領域。 */
  scroller: HTMLElement;
  /** ゲームのホームの、地を除く表示全体。ピースを運ぶ間に引く。 */
  screen: HTMLElement;
  /** ピースの輪郭の SVG パス。マスの左上を原点、1辺を 1 とする。 */
  piecePath: string;
  /** ゲームの濃淡2色のピクトグラム。運ぶピースの面に浮かべ、どのゲームの1問へ入るかを見せる。 */
  pictogramSvg: string;
  /**
   * 抜く前に、台紙を送ってピースを見えている高さの中央へ運ぶか。ゲームが選んだ問題を、台紙のどこから抜いたかが分かるようにする。
   * 運ばないときも、ピースが台紙の見えている範囲の外にあれば、見える所へ送ってから抜く。
   */
  spinsToPiece: boolean;
  /** ピースを運び終えて、プレイを始めるとき。演出を飛ばしたときもすぐに呼ぶ。一度だけ呼ぶ。 */
  onEnter: () => void;
};

function canAnimate(element: Element): boolean {
  return typeof element.animate === "function" && !prefersReducedMotion();
}

/** 抜くピースを、台紙の見えている高さの中央へ運ぶスクロール位置。 */
function findCenteredScrollTop(
  square: HTMLElement,
  scroller: HTMLElement,
): number {
  const squareRect = square.getBoundingClientRect();
  const view = readZukanSheetView(scroller);
  const offset =
    squareRect.top + squareRect.height / 2 - (view.top + view.bottom) / 2;
  const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
  return Math.min(Math.max(scroller.scrollTop + offset, 0), maxScrollTop);
}

/** マスが、台紙の見えている範囲に収まっているか。 */
function isFullyVisible(square: HTMLElement, scroller: HTMLElement): boolean {
  const squareRect = square.getBoundingClientRect();
  const view = readZukanSheetView(scroller);
  return (
    squareRect.top >= view.top &&
    squareRect.top + squareRect.height <= view.bottom
  );
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/** 運ぶピースの面に浮かべるピクトグラムの、ピースの1辺に対する大きさ。タブの凹みにかからない大きさにする。 */
const PIECE_PICTOGRAM_SIZE = 0.5;

/** 運ぶ間に、ピースの面を状態の色から明るい面へ替え、その上にピクトグラムを浮かべる層。 */
function createPieceFace(piecePath: string, pictogramSvg: string): SVGGElement {
  const face = document.createElementNS(SVG_NAMESPACE, "g");
  face.dataset.zukanPlayEntryFace = "";
  face.style.opacity = "0";
  const surface = document.createElementNS(SVG_NAMESPACE, "path");
  surface.setAttribute("d", piecePath);
  surface.setAttribute("fill", "var(--background)");
  face.append(surface);
  const pictogram = new DOMParser().parseFromString(
    pictogramSvg,
    "image/svg+xml",
  ).documentElement;
  if (pictogram.localName === "svg") {
    const offset = (1 - PIECE_PICTOGRAM_SIZE) / 2;
    pictogram.setAttribute("x", String(offset));
    pictogram.setAttribute("y", String(offset));
    pictogram.setAttribute("width", String(PIECE_PICTOGRAM_SIZE));
    pictogram.setAttribute("height", String(PIECE_PICTOGRAM_SIZE));
    face.append(document.importNode(pictogram, true));
  }
  return face;
}

function createPieceLayer(
  square: HTMLElement,
  piecePath: string,
  pictogramSvg: string,
): SVGElement {
  const { left, top, width, height } = square.getBoundingClientRect();
  const layer = document.createElementNS(SVG_NAMESPACE, "svg");
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("viewBox", ZUKAN_PIECE_VIEW_BOX);
  layer.dataset.zukanPlayEntryPiece = "";
  // マスと同じ色で塗るよう、マスの面が継いでいる色（状態の色）を移す。
  const face = square.querySelector("svg");
  layer.style.color = face === null ? "" : getComputedStyle(face).color;
  Object.assign(layer.style, {
    position: "fixed",
    left: `${left - width / 2}px`,
    top: `${top - height / 2}px`,
    width: `${width * 2}px`,
    height: `${height * 2}px`,
    overflow: "visible",
    pointerEvents: "none",
    zIndex: "var(--layer-overlay)",
    filter: `drop-shadow(0 ${width * 0.04}px ${width * 0.05}px rgb(0 0 0 / 0.28))`,
  });
  layer.style.setProperty("--game-pictogram-strong", "var(--foreground)");
  layer.style.setProperty("--game-pictogram-soft", "var(--muted-foreground)");
  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", piecePath);
  path.setAttribute("fill", "currentColor");
  layer.append(path, createPieceFace(piecePath, pictogramSvg));
  return layer;
}

/**
 * 台紙の1問を始めるときに、そのピースを台紙から抜いて画面の中央へ大きく運び、プレイ画面の上で広げて消す。
 * 運ぶ間に、ピースの面を明るい面へ替えてゲームのピクトグラムを浮かべ、どのゲームの1問へ入るかを見せる。
 * ゲームのホームとプレイ画面は同じゲームの地の上にあるので、ピースだけを残してほかの表示を引き、ピースの中へ入っていくように見せる。
 * ピースの層は、画面を移っても残るよう `document.body` に置き、消し終えたら取り除く。
 * 動きの間に画面を押すかキーを押すと、すぐに始める。動きを減らす設定と動かせない環境では、何も動かさずにすぐ始める。
 * 戻り値の `skip` は演出を飛ばしてすぐ始め、`cancel` は始める前なら始めずにやめて、動かしたものを元へ戻す。始めたあとの `cancel` は何もしない。
 */
export function playZukanPlayEntry({
  square,
  scroller,
  screen,
  piecePath,
  pictogramSvg,
  spinsToPiece,
  onEnter,
}: ZukanPlayEntry): ZukanPlayEntryControl {
  rememberZukanPlayPiece({ piecePath, pictogramSvg });
  if (!canAnimate(square)) {
    onEnter();
    return { skip() {}, cancel() {} };
  }

  let hasEntered = false;
  let isDissolving = false;
  let spinFrame = 0;
  let layer: SVGElement | null = null;
  let screenFade: Animation | null = null;

  function stopWaiting() {
    cancelAnimationFrame(spinFrame);
    window.removeEventListener("pointerdown", skipByPointer, true);
    window.removeEventListener("keydown", skipByKey, true);
  }

  function cancel() {
    if (hasEntered) {
      return;
    }
    hasEntered = true;
    stopWaiting();
    layer?.remove();
    layer = null;
    screenFade?.cancel();
    square.style.visibility = "";
  }

  function enter() {
    if (hasEntered) {
      return;
    }
    hasEntered = true;
    stopWaiting();
    onEnter();
  }

  function dissolve() {
    enter();
    if (layer === null || isDissolving) {
      return;
    }
    isDissolving = true;
    const dissolving = layer;
    const { transform } = getComputedStyle(dissolving);
    const lifted = transform === "none" ? "" : transform;
    dissolving
      .animate(
        [
          { transform: lifted, opacity: 1 },
          { transform: `${lifted} scale(${DISSOLVE_SCALE})`, opacity: 0 },
        ],
        {
          duration: ZUKAN_PLAY_ENTRY_DURATION_MS.dissolve,
          easing: MOTION_EASING.exit,
          fill: "forwards",
        },
      )
      .finished.finally(() => dissolving.remove());
  }

  // 飛ばした押下の続きのクリックが、移った先のプレイ画面の盤面を操作しないよう、そのクリックを1回だけ捨てる。
  function skipByPointer(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }
    function swallowClick(event: MouseEvent) {
      event.stopPropagation();
      event.preventDefault();
    }
    window.addEventListener("click", swallowClick, {
      capture: true,
      once: true,
    });
    setTimeout(
      () => window.removeEventListener("click", swallowClick, true),
      SKIP_CLICK_SWALLOW_MS,
    );
    dissolve();
  }

  function skipByKey(event: KeyboardEvent) {
    if (!event.repeat && !event.isComposing && !MODIFIER_KEYS.has(event.key)) {
      dissolve();
    }
  }

  function lift() {
    if (hasEntered) {
      return;
    }
    layer = createPieceLayer(square, piecePath, pictogramSvg);
    layer
      .querySelector("[data-zukan-play-entry-face]")
      ?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: ZUKAN_PLAY_ENTRY_DURATION_MS.lift,
        easing: MOTION_EASING.exit,
        fill: "forwards",
      });
    document.body.append(layer);
    square.style.visibility = "hidden";
    const { left, top, width, height } = square.getBoundingClientRect();
    const dx = window.innerWidth / 2 - (left + width / 2);
    const dy = window.innerHeight / 2 - (top + height / 2);
    const scale = LIFTED_PIECE_SIZE_PX / width;
    screenFade = screen.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: ZUKAN_PLAY_ENTRY_DURATION_MS.lift,
      easing: MOTION_EASING.standard,
      fill: "forwards",
    });
    layer
      .animate(
        [
          { transform: "translate(0, 0) scale(1)" },
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        ],
        {
          duration: ZUKAN_PLAY_ENTRY_DURATION_MS.lift,
          easing: MOTION_EASING.standard,
          fill: "forwards",
        },
      )
      .finished.then(dissolve, () => {});
  }

  function spin() {
    const from = scroller.scrollTop;
    const to =
      spinsToPiece || !isFullyVisible(square, scroller)
        ? findCenteredScrollTop(square, scroller)
        : from;
    if (Math.abs(to - from) < 1) {
      lift();
      return;
    }
    const startedAt = performance.now();
    function step(now: number) {
      const progress = Math.min(
        (now - startedAt) / ZUKAN_PLAY_ENTRY_DURATION_MS.spin,
        1,
      );
      scroller.scrollTop = from + (to - from) * easeOutCubic(progress);
      if (progress < 1) {
        spinFrame = requestAnimationFrame(step);
      } else {
        lift();
      }
    }
    spinFrame = requestAnimationFrame(step);
  }

  // 動きの間、ゲームのホームは操作を受け付けないので、飛ばす操作は画面のどこでも受けられるよう window で受ける。
  window.addEventListener("pointerdown", skipByPointer, true);
  window.addEventListener("keydown", skipByKey, true);

  spin();

  return { skip: dissolve, cancel };
}

export const _private = {
  findCenteredScrollTop,
  ZUKAN_PLAY_ENTRY_DURATION_MS,
};
