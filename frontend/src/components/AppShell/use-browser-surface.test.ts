import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

import { useBrowserSurface } from "@/components/AppShell/use-browser-surface";

describe("useBrowserSurface", () => {
  let header: HTMLElement;
  let meta: HTMLMetaElement;

  beforeEach(() => {
    document.documentElement.style.backgroundColor = "rgb(10, 20, 30)";
    document.body.style.backgroundColor = "rgb(40, 50, 60)";
    document.documentElement.style.setProperty("--browser-surface", "initial");
    meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#123456";
    document.head.append(meta);
    header = document.createElement("header");
    header.dataset.browserSurface = "self";
    header.style.backgroundColor = "rgb(39, 49, 58)";
    document.body.append(header);
  });

  afterEach(() => {
    cleanup();
    header.remove();
    meta.remove();
    document.documentElement.style.removeProperty("background-color");
    document.documentElement.style.removeProperty("--browser-surface");
    document.documentElement.classList.remove("dark");
    document.body.style.removeProperty("background-color");
  });

  test("プレイの地へ切り替え、離れたらブランドの地をbodyとテーマ色へ戻すこと", async () => {
    const { unmount } = renderHook(useBrowserSurface);
    act(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        '<div data-browser-surface="child"><div style="background-color:rgb(229, 238, 240)"></div></div>',
      );
    });

    await waitFor(() => {
      expect(document.body.style.backgroundColor).toBe("rgb(229, 238, 240)");
      expect(meta.content).toBe("rgb(229, 238, 240)");
      expect(
        document.documentElement.style.getPropertyValue("--browser-surface"),
      ).toBe("rgb(229, 238, 240)");
    });

    act(() =>
      document.querySelector('[data-browser-surface="child"]')?.remove(),
    );

    await waitFor(() => {
      expect(document.body.style.backgroundColor).toBe("rgb(39, 49, 58)");
      expect(meta.content).toBe("rgb(39, 49, 58)");
    });
    unmount();
  });

  test("表示モードの変更後の色をbodyへ反映すること", async () => {
    renderHook(useBrowserSurface);
    act(() => {
      header.style.backgroundColor = "rgb(28, 41, 45)";
      document.documentElement.classList.add("dark");
    });

    await waitFor(() => {
      expect(document.body.style.backgroundColor).toBe("rgb(28, 41, 45)");
      expect(meta.content).toBe("rgb(28, 41, 45)");
    });
  });

  test("終了したら元の背景とテーマ色を復元すること", () => {
    const { unmount } = renderHook(useBrowserSurface);
    unmount();

    expect(document.documentElement.style.backgroundColor).toBe(
      "rgb(10, 20, 30)",
    );
    expect(document.body.style.backgroundColor).toBe("rgb(40, 50, 60)");
    expect(
      document.documentElement.style.getPropertyValue("--browser-surface"),
    ).toBe("initial");
    expect(meta.content).toBe("#123456");
  });
});
