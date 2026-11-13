import type { DataRouter, To } from "react-router";
import {
  type ScreenTransitionKind,
  screenTransitionKind,
} from "@/app/navigation/screen-transition-kind";
import { MOTION_DURATION_MS, MOTION_EASING } from "@/lib/motion";
import {
  runScreenTransition,
  type ScreenTransitionCarrier,
} from "@/lib/screen-transition";
import "@/app/shell/screen-transitions.css";

const FRAME_SELECTOR = "[data-screen-frame]";
const CONTENT_SELECTOR = "[data-screen-content]";

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

/** 種類ごとの、額を測る時機と運ばない表示を引く動きを、運ぶものの動きの前後に足す。 */
function withFrameMotion(
  kind: ScreenTransitionKind,
  carrier: ScreenTransitionCarrier = {},
): ScreenTransitionCarrier {
  let restoreContent: (() => void) | undefined;
  return {
    async before() {
      restoreContent = undefined;
      if (MEASURES_FRAME_BEFORE.has(kind)) measureFrame();
      await carrier.before?.();
      if (LEAVES_CONTENT_FIRST.has(kind)) restoreContent = await leaveContent();
    },
    after() {
      restoreContent?.();
      const carried = carrier.after?.();
      if (!MEASURES_FRAME_BEFORE.has(kind)) measureFrame();
      return carried;
    },
    skip: carrier.skip,
  };
}

function pathnameOf(to: To | null): string | null {
  if (to === null) return null;
  if (typeof to === "string") {
    return new URL(to, window.location.href).pathname;
  }
  return to.pathname ?? window.location.pathname;
}

/** 行き来の種類ごとの、画面とは別に運ぶもの。 */
export type ScreenTransitionCarriers = Partial<
  Record<ScreenTransitionKind, ScreenTransitionCarrier>
>;

export function installScreenTransitions(
  router: DataRouter,
  carriers: ScreenTransitionCarriers,
): void {
  const navigate = router.navigate.bind(router);

  function navigateWithTransition(to: To | number | null, options?: object) {
    const toPathname = typeof to === "number" ? null : pathnameOf(to);
    const kind =
      toPathname === null
        ? null
        : screenTransitionKind(window.location.pathname, toPathname);
    if (kind === null) {
      return navigate(to as To, options);
    }
    return runScreenTransition(
      kind,
      // 遷移先を一度に描き切ってから動かすので、分けて描かせない。
      () => navigate(to as To, { ...options, flushSync: true }),
      withFrameMotion(kind, carriers[kind]),
    );
  }

  router.navigate = navigateWithTransition as DataRouter["navigate"];
}
