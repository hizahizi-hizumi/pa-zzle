import { useEffect } from "react";

/** 共通ヘッダー・プレイの地・タイトルのうち、最後に描かれた面をブラウザの色にも使う。 */
export function useBrowserSurface() {
  useEffect(() => {
    const root = document.documentElement;
    const previousBackground = root.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;
    const previousSurface = root.style.getPropertyValue("--browser-surface");
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
      let color = getComputedStyle(paint).backgroundColor;
      // theme-color は Safari でも扱える sRGB にする（背景のトークンには OKLCH もある）。
      if (!color.startsWith("rgb")) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
        color = `rgb(${red}, ${green}, ${blue})`;
      }
      if (meta.content !== color) meta.content = color;
      if (root.style.backgroundColor !== color)
        root.style.backgroundColor = color;
      if (document.body.style.backgroundColor !== color)
        document.body.style.backgroundColor = color;
      root.style.setProperty("--browser-surface", color);
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
      if (existingMeta) meta.content = previousTheme;
      else meta.remove();
    };
  }, []);
}
