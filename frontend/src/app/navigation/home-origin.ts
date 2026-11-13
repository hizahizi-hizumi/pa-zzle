import type { DataRouter } from "react-router";

let homeOriginGameId: string | null = null;

function isHome(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === "";
}

/** ゲームの画面（ゲームのホームと、その下のプレイ・結果など）のパスなら、そのゲームの ID。 */
function findGameIdOfPath(pathname: string): string | null {
  return /^\/puzzles\/([^/]+)/.exec(pathname)?.[1] ?? null;
}

/**
 * 画面を行き来するたびに、ホームへ来たのなら、来る前にいたゲームの画面のゲームを覚える。
 * ブラウザの戻る・進むで来たときも同じに覚えるよう、ルーターの遷移を見る。戻り値は、見るのをやめる関数。
 */
export function followHomeOrigin(
  router: Pick<DataRouter, "state" | "subscribe">,
): () => void {
  let pathname = router.state.location.pathname;
  return router.subscribe(({ location }) => {
    if (location.pathname === pathname) return;
    homeOriginGameId = isHome(location.pathname)
      ? findGameIdOfPath(pathname)
      : null;
    pathname = location.pathname;
  });
}

/** 今のホームへ、ゲームの画面から来たときの、そのゲームの ID。アプリを開いた直後など、ゲームの画面から来ていなければ `null`。 */
export function readHomeOriginGameId(): string | null {
  return homeOriginGameId;
}

function resetForTest(): void {
  homeOriginGameId = null;
}

export const _private = { resetForTest };
