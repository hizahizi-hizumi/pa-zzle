import { useEffect } from "react";

/** CSS の色を、theme-color として Safari でも扱える sRGB にする（背景のトークンには OKLCH もある）。 */
function toSrgb(color: string): string | null {
  if (color.startsWith("rgb")) {
    return color;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return `rgb(${red}, ${green}, ${blue})`;
}

/**
 * 共通ヘッダー・プレイの地・タイトルのうち、最後に描かれた面をブラウザの色にも使う。
 * 面が CSS 変数 `--browser-bottom-paint` で下の端の色を別に示していれば、画面の下の端の面（`--browser-surface-bottom`）はその色にする。
 * 示す変数を書き出す変数と分けるのは、`html` に書き出した値が面へ継がれて、面の示した色に見えないようにするため。
 */
export function useBrowserSurface() {
  useEffect(() => {
    const root = document.documentElement;
    const previousBackground = root.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;
    const previousSurface = root.style.getPropertyValue("--browser-surface");
    const previousBottomSurface = root.style.getPropertyValue(
      "--browser-surface-bottom",
    );
    const existingMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const meta = existingMeta ?? document.createElement("meta");
    const previousTheme = meta.content;
    if (!existingMeta) {
      meta.name = "theme-color";
      document.head.append(meta);
    }
    function update() {
      const surfaces = document.querySelectorAll<HTMLElement>(
        "[data-browser-surface]",
      );
      const surface = surfaces[surfaces.length - 1];
      if (!surface) return;
      const paint =
        surface.dataset.browserSurface === "child"
          ? (surface.firstElementChild ?? surface)
          : surface;
      const paintStyle = getComputedStyle(paint);
      const color = toSrgb(paintStyle.backgroundColor);
      if (!color) return;
      const declaredBottom = paintStyle
        .getPropertyValue("--browser-bottom-paint")
        .trim();
      const bottomColor = (declaredBottom && toSrgb(declaredBottom)) || color;
      if (meta.content !== color) meta.content = color;
      if (root.style.backgroundColor !== color)
        root.style.backgroundColor = color;
      if (document.body.style.backgroundColor !== color)
        document.body.style.backgroundColor = color;
      root.style.setProperty("--browser-surface", color);
      root.style.setProperty("--browser-surface-bottom", bottomColor);
    }

    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    update();
    return () => {
      observer.disconnect();
      root.style.backgroundColor = previousBackground;
      document.body.style.backgroundColor = previousBodyBackground;
      if (previousSurface)
        root.style.setProperty("--browser-surface", previousSurface);
      else root.style.removeProperty("--browser-surface");
      if (previousBottomSurface)
        root.style.setProperty(
          "--browser-surface-bottom",
          previousBottomSurface,
        );
      else root.style.removeProperty("--browser-surface-bottom");
      if (existingMeta) meta.content = previousTheme;
      else meta.remove();
    };
  }, []);
}
