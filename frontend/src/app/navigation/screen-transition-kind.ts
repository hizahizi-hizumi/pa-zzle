/** 画面の行き来の動きの種類。それぞれの動きは `app/shell/screen-transitions.css` が描く。 */
export type ScreenTransitionKind =
  | "enter-game"
  | "leave-game"
  | "enter-piece"
  | "open"
  | "settle"
  | "return"
  | "close";

type Screen = "home" | "game-home" | "play" | "result";

function screenOf(pathname: string): Screen | null {
  const path = pathname.replace(/\/+$/, "");
  if (path === "") return "home";
  if (/^\/puzzles\/[^/]+$/.test(path)) return "game-home";
  if (/^\/puzzles\/[^/]+\/play\/[^/]+$/.test(path)) return "play";
  if (/^\/puzzles\/[^/]+\/result\/[^/]+$/.test(path)) return "result";
  return null;
}

const KINDS: Partial<
  Record<Screen, Partial<Record<Screen, ScreenTransitionKind>>>
> = {
  home: { "game-home": "enter-game" },
  "game-home": { home: "leave-game", play: "enter-piece" },
  play: { result: "settle", home: "close" },
  result: { play: "open", "game-home": "return", home: "close" },
};

/** パス `fromPathname` の画面から `toPathname` の画面への行き来の動きの種類。動かさない行き来では `null`。 */
export function screenTransitionKind(
  fromPathname: string,
  toPathname: string,
): ScreenTransitionKind | null {
  const from = screenOf(fromPathname);
  const to = screenOf(toPathname);
  if (!from || !to) return null;
  return KINDS[from]?.[to] ?? null;
}
