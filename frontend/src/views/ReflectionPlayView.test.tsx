import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { selectReflectionProblemForDifficulty } from "@/games/reflection/problem-selection";
import type { ReflectionBoard } from "@/games/reflection/puzzle/board";
import { reflectionPieceLabels } from "@/games/reflection/ui/piece-label";
import { readPlayRecords } from "@/records/storage";
import { ReflectionPlayView } from "@/views/ReflectionPlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));
const problemSeed = "reflection-play-view";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: () => problemSeed,
}));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
  window.localStorage.clear();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/reflection/play/:difficulty"
          element={<ReflectionPlayView />}
        />
        <Route path="/puzzles/reflection" element={<p>難易度選択画面</p>} />
        <Route path="/records" element={<p>記録画面</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function openMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

function getBoardCells(): HTMLElement[] {
  return within(
    screen.getByRole("group", { name: `${REFLECTION_DISPLAY_NAME}盤面` }),
  ).getAllByRole("button");
}

/** 解どおりに、ストックの種類を選んでからマスを押して置く。 */
function solve(solution: ReflectionBoard): void {
  const stock = screen.getByRole("group", { name: "ストック" });
  const cells = getBoardCells();
  solution.cells.forEach((piece, cellIndex) => {
    if (piece === null) return;
    const stockButton = within(stock).getByRole("button", {
      name: new RegExp(`^${reflectionPieceLabels[piece]} `),
    });
    // 置いた後も同じ種類が残っていれば選択が続くので、選ばれていない時だけ押す。
    if (stockButton.getAttribute("aria-pressed") !== "true") {
      fireEvent.click(stockButton);
    }
    fireEvent.click(cells[cellIndex] as HTMLElement);
  });
}

describe("ReflectionPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/reflection/play/1");
    });

    test("空の盤面とストックを持つプレイ画面を表示すること", () => {
      const cells = getBoardCells();
      const stock = within(
        screen.getByRole("group", { name: "ストック" }),
      ).getAllByRole("button");

      expect(cells).toHaveLength(25);
      expect(cells.every((cell) => cell.textContent === "")).toBe(true);
      expect(stock.length).toBeGreaterThan(0);
    });

    test("戻るボタンで難易度選択画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });

    test("メニューの難易度変更で難易度選択画面へ移ること", () => {
      openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "難易度変更" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });

    test("内部診断を使えないビルドではメニューに検証情報を出さないこと", () => {
      openMenu();

      const item = screen.queryByRole("menuitem", { name: "検証情報" });

      expect(item).toBeNull();
    });
  });

  describe("通常の出題を解き終えた場合", () => {
    const selected = selectReflectionProblemForDifficulty("1", problemSeed);

    beforeEach(() => {
      renderAt("/puzzles/reflection/play/1");
      solve(selected.problem.solution);
    });

    test("結果画面で難易度とスコアを示すこと", () => {
      const resultScreen = within(
        screen.getByRole("region", { name: "プレイ結果" }),
      );

      expect(resultScreen.getByText("レベル 1")).toBeTruthy();
      expect(resultScreen.getByRole("region", { name: "スコア" })).toBeTruthy();
    });

    test("遊んだ問題と作業の量とプレイの事実を記録へ保存すること", () => {
      const records = readPlayRecords();

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        gameId: "reflection",
        payload: {
          difficulty: "1",
          problemIdentity: selected.identity,
          workload: selected.workload,
          performance: { relocationCount: 0, restartCount: 0 },
        },
      });
    });

    test("記録を確認で記録画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "記録を確認" }));

      expect(screen.getByText("記録画面")).toBeTruthy();
    });

    test("難易度変更で難易度選択画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度変更" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });

    describe("同じ問題をもう一度解いた場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "同じ問題" }));
        solve(selected.problem.solution);
      });

      test("もう1件の記録として保存すること", () => {
        const records = readPlayRecords();

        expect(records).toHaveLength(2);
      });
    });
  });

  describe("内部診断を使えるビルドの場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/reflection/play/3");
      openMenu();
    });

    test("メニューの検証情報から出題中の問題の検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = screen.getByRole("dialog", { name: "検証情報" });

      // 出題した難易度と、分析し直した分類。
      expect(within(dialog).getAllByText("レベル 3")).toHaveLength(2);
      expect(within(dialog).getByText(/^rf-/)).toBeTruthy();
      expect(within(dialog).getByText(/^v4 \/ 3-\d+$/)).toBeTruthy();
      expect(within(dialog).getByText("L3")).toBeTruthy();
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/reflection/play/9");
    });

    test("選べない難易度であることを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/reflection");
    });
  });
});
