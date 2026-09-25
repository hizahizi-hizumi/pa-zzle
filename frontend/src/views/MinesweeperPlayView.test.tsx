import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import {
  listMinesweeperPoolEntries,
  toMinesweeperPoolIdentity,
} from "@/games/minesweeper/problem/problem-pool";
import { MinesweeperPlayView } from "./MinesweeperPlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
});

function openDiagnostics(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
  fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/minesweeper/play/:difficulty"
          element={<MinesweeperPlayView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MinesweeperPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/minesweeper/play/1");
    });

    test("プレイ画面を表示すること", () => {
      const backButton = screen.getByRole("button", {
        name: "難易度選択へ戻る",
      });

      expect(backButton).toBeTruthy();
      expect(screen.queryByText("この難易度は選べません")).toBeNull();
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/minesweeper/play/9");
    });

    test("選べない難易度であることを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/minesweeper");
    });
  });

  describe("内部診断を使える環境で問題集のseedを指定した場合", () => {
    const identity = toMinesweeperPoolIdentity(
      "5",
      listMinesweeperPoolEntries("5")[7]!,
    );

    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt(
        `/puzzles/minesweeper/play/5?seed=${encodeURIComponent(identity.seed)}`,
      );
    });

    test("その問題を再現し検証情報にseedを示すこと", () => {
      const cells = within(
        screen.getByRole("group", { name: "マインスイーパー盤面" }),
      ).getAllByRole("button");

      openDiagnostics();

      expect(cells).toHaveLength(
        identity.conditions.rows * identity.conditions.columns,
      );
      expect(screen.getByText(identity.seed)).toBeTruthy();
    });
  });

  describe("内部診断を使えない環境の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/minesweeper/play/1");
    });

    test("メニューに検証情報を出さないこと", () => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );

      expect(screen.queryByRole("menuitem", { name: "検証情報" })).toBeNull();
    });
  });
});
