import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { TakuzuPlayView } from "@/views/TakuzuPlayView";

afterEach(() => {
  cleanup();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/takuzu/play/:difficulty"
          element={<TakuzuPlayView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TakuzuPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/takuzu/play/1");
    });

    test("8×8 の盤面を持つプレイ画面を表示すること", () => {
      const cells = within(
        screen.getByRole("group", { name: "盤面" }),
      ).getAllByRole("button");

      expect(cells).toHaveLength(64);
      expect(screen.queryByText("この難易度は選べません")).toBeNull();
    });

    describe("メニューを開いた場合", () => {
      beforeEach(() => {
        fireEvent.pointerDown(
          screen.getByRole("button", { name: "その他の操作" }),
          { button: 0, ctrlKey: false },
        );
      });

      test("別の問題を選べること", () => {
        const result = screen.queryByRole("menuitem", { name: "別の問題" });

        expect(result).not.toBeNull();
      });
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/takuzu/play/9");
    });

    test("選べない難易度であることを示しホームへ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "ホームへ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/");
    });
  });
});
