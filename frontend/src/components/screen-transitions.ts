import type { DataRouter, To } from "react-router";
import { startShowcaseAtRest } from "@/components/game-pictogram-motion";
import {
  runScreenTransition,
  type ScreenTransitionCarrier,
  type ScreenTransitionKind,
  screenTransitionKind,
} from "@/lib/screen-transition";

function pathnameOf(to: To | null): string | null {
  if (to === null) return null;
  if (typeof to === "string") {
    return new URL(to, window.location.href).pathname;
  }
  return to.pathname ?? window.location.pathname;
}

// 運ぶピクトグラムは、遷移元と遷移先で同じ姿でないと、着いたときに姿が跳ぶ。
// 遷移先は静止した姿から動き始めるので、遷移元も静止した姿にそろえてから運ぶ。
function restSharedPictograms(): void {
  for (const pictogram of document.querySelectorAll(
    '[data-screen-shared="pictogram"] [data-pictogram-motion="play"]',
  )) {
    startShowcaseAtRest(pictogram);
  }
}

const STYLE_PARAMETER = "motion";
const STYLE_STORAGE_KEY = "pa-zzle.screen-transition-style";
const COMPARED_STYLES = ["depth", "flat"];

// 見せ方を比べて決めるまでの間、URL の `?motion=depth|flat` で切り替えられるようにする。選んだ見せ方はタブを閉じるまで保つ。
function applyComparedStyle(): void {
  try {
    const requested = new URLSearchParams(window.location.search).get(
      STYLE_PARAMETER,
    );
    if (requested !== null && COMPARED_STYLES.includes(requested)) {
      window.sessionStorage.setItem(STYLE_STORAGE_KEY, requested);
    }
    const style = window.sessionStorage.getItem(STYLE_STORAGE_KEY);
    if (style !== null) {
      document.documentElement.setAttribute("data-screen-style", style);
    }
  } catch {
    // 保存先を使えない環境では、既定の見せ方のままにする。
  }
}

/**
 * アプリの中の行き来を、行き来する画面の組で決まる動きで見せる。
 * 動きは行き来を起こす各所ではなくここ一か所で決め、同じ組の行き来がどこから起きても同じ動きになるようにする。
 * ブラウザの戻る・進むは、ブラウザ自身の動き（Safari のスワイプで戻る動きなど）と重なるので動かさない。
 */
const sharedPictogramCarrier: ScreenTransitionCarrier = {
  before: restSharedPictograms,
};

/** 行き来の種類ごとの、画面とは別に運ぶもの。 */
export type ScreenTransitionCarriers = Partial<
  Record<ScreenTransitionKind, ScreenTransitionCarrier>
>;

export function installScreenTransitions(
  router: DataRouter,
  carriers: ScreenTransitionCarriers = {},
): void {
  const carrierOf: ScreenTransitionCarriers = {
    "enter-game": sharedPictogramCarrier,
    "leave-game": sharedPictogramCarrier,
    ...carriers,
  };
  applyComparedStyle();
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
      carrierOf[kind],
    );
  }

  router.navigate = navigateWithTransition as DataRouter["navigate"];
}
