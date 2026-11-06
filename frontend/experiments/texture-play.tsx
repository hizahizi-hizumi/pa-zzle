import { routes } from "@generouted/react-router";
import { createRoot } from "react-dom/client";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { gameCatalog } from "@/game-catalog/game-catalog";
import { parseDifficultyLevel } from "@/games/difficulty";
import "@/index.css";
import "./texture-variants.css";

const params = new URLSearchParams(window.location.search);
const game =
  gameCatalog.find((entry) => entry.id === params.get("game")) ??
  gameCatalog[0];
const difficulty =
  parseDifficultyLevel(params.get("level") ?? undefined) ?? "3";
const problemId = game.listPoolProblemIds(difficulty)[0];
const path = `${game.playPath.replace(":difficulty", String(difficulty))}?problem=${problemId}`;
const root = document.getElementById("root");
if (!root) throw new Error("Missing experiment root");
document.documentElement.dataset.game = game.id;

const variants = [
  "original",
  "lines",
  "individual",
  "objects",
  "movable",
  "flat",
];
function setVariant(value: unknown) {
  if (typeof value === "string" && variants.includes(value)) {
    document.documentElement.dataset.texture = value;
  }
}
setVariant(params.get("variant") ?? "original");
window.addEventListener("message", (event: MessageEvent) => {
  if (event.origin !== window.location.origin || event.source !== window.parent)
    return;
  if (event.data?.type === "texture-variant") setVariant(event.data.variant);
});
window.parent.postMessage({ type: "texture-ready" }, window.location.origin);

// 本番の部品は変更せず、比較用の文書の中だけで描画箇所へ目印を付ける。
function mark(selector: string, name: string) {
  for (const element of document.querySelectorAll(selector)) {
    element.setAttribute(`data-lab-${name}`, "");
  }
}
function markSurfaces() {
  if (game.id === "nanpure") mark("div.grid.grid-cols-9.border-2", "grid");
  if (game.id === "takuzu") mark('[aria-label="バイナリパズル盤面"]', "grid");
  if (game.id === "minesweeper")
    mark('[aria-label="マインスイーパー盤面"]', "grid");
  if (game.id === "reflection")
    mark("div.outline-2.outline-solid", "reflection-grid");
  if (game.id === "slide-puzzle") {
    mark('div[class*="@container"][class*="bg-muted"]', "slide-board");
    mark('[role="group"] button > span, button.group > span', "tile");
  }
  if (game.id === "water-sort") mark('button[aria-label^="ボトル"]', "bottle");
  if (game.id === "tsume-shogi") {
    mark('[style*="background-image"]', "wood");
    mark('div[class*="bg-[radial-gradient"]', "sheen");
    mark('span[class*="bg-[radial-gradient"]:not([data-clear-glow])', "sheen");
    mark('path[class*="fill-[#2d1605]"]', "piece-shadow");
    mark('path[class*="fill-[#fde894]"]', "piece-face");
    mark('use[class*="fill-[#fff2dc]"]', "glyph-gloss");
  }
}
new MutationObserver(markSurfaces).observe(root, {
  childList: true,
  subtree: true,
});
const router = createMemoryRouter(routes, { initialEntries: [path] });
createRoot(root).render(<RouterProvider router={router} />);
