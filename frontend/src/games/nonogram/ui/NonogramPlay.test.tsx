import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";

import type { NonogramResult } from "@/games/nonogram/play/use-nonogram-play";
import { createNonogramProblem } from "@/games/nonogram/problem/problem";
import { parseNonogramBoard } from "@/games/nonogram/puzzle/board";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";
import { findNonogramMatchedLines } from "@/games/nonogram/puzzle/rules";
import { NonogramPlay } from "@/games/nonogram/ui/NonogramPlay";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

type NonogramPlayProps = ComponentProps<typeof NonogramPlay>;

const { clues } = createNonogramProblem(
  parseNonogramPattern(["#.#", "###", ".#."]),
);
const board = parseNonogramBoard(["#.#", "x..", "..."]);

/**
 * 基準時間 01:26（10秒 + 16本 × 2秒 + 32マス × 0.75秒 + 4回 × 5秒）の問題を 01:41 で、
 * 塗り直し2マス・待った3回・盤面を戻した回数1回で解いた結果。
 */
const result: NonogramResult = {
  elapsedMs: 101_000,
  repaintCount: 2,
  crossToggleCount: 9,
  undoCount: 3,
  restartCount: 1,
  inputCount: 40,
  workload: { width: 8, height: 8, filledCellCount: 32, roundCount: 4 },
  speedRule: { fullScoreMs: 86_000, zeroScoreMs: 258_000 },
  timeDeltaMs: 15_000,
  score: { total: 87, breakdown: { speed: 78, accuracy: 9 } },
};

function createProps(overrides: Partial<NonogramPlayProps> = {}) {
  return {
    difficulty: "1",
    progress: "playing",
    elapsedMs: 0,
    result: null,
    recordOutcomeNotice: null,
    board,
    clues,
    matchedLines: findNonogramMatchedLines(board, clues),
    strokeRange: null,
    repaintCount: 2,
    operation: null,
    canUndo: true,
    canRestart: true,
    onStartStroke: vi.fn(),
    onExtendStroke: vi.fn(),
    onEndStroke: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenRecords: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
    ...overrides,
  } satisfies NonogramPlayProps;
}

function renderPlay(props: NonogramPlayProps): void {
  render(
    <MemoryRouter>
      <NonogramPlay {...props} />
    </MemoryRouter>,
  );
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "ノノグラム盤面" });
}

function getCell(name: string): HTMLElement {
  return within(getBoard()).getByRole("button", { name });
}

function press(
  cell: HTMLElement,
  init: { pointerType: string; button?: number },
): void {
  const pointer = { pointerId: 1, isPrimary: true, button: 0, ...init };
  fireEvent.pointerDown(cell, pointer);
  fireEvent.pointerUp(getBoard(), pointer);
}

afterEach(() => {
  cleanup();
});

describe("NonogramPlay", () => {
  describe("プレイ中の場合", () => {
    let props: ReturnType<typeof createProps>;

    beforeEach(() => {
      props = createProps();
      renderPlay(props);
    });

    test("見出しに表示名と塗り直したマスの数と経過時間を出し、待ったの回数は出さないこと", () => {
      const header = within(
        screen.getByRole("heading", { name: "ノノグラム" })
          .parentElement as HTMLElement,
      );

      expect(header.getByText("塗り直し")).toBeTruthy();
      expect(header.getByText("2")).toBeTruthy();
      expect(header.getByText("00:00")).toBeTruthy();
      expect(header.queryByText("待った")).toBeNull();
    });

    test("盤面のマスを状態の名前で示すこと", () => {
      const names = within(getBoard())
        .getAllByRole("button")
        .map((cell) => cell.getAttribute("aria-label"));

      expect(names.slice(0, 4)).toEqual([
        "1行1列 塗り",
        "1行2列 未確定",
        "1行3列 塗り",
        "2行1列 バツ",
      ]);
    });

    test("塗りがヒントにちょうど合った行のヒントを一致として示すこと", () => {
      const matched = screen.getByRole("note", {
        name: "1行目のヒント 1 1 一致",
      });
      const unmatched = screen.getByRole("note", { name: "2行目のヒント 3" });

      expect(matched).toBeDefined();
      expect(unmatched).toBeDefined();
    });

    test("指でマスを押して離すと、塗りの入力を始めて終えること", () => {
      press(getCell("1行2列 未確定"), { pointerType: "touch" });

      expect(props.onStartStroke).toHaveBeenCalledWith(1, "filled");
      expect(props.onEndStroke).toHaveBeenCalledOnce();
    });

    test("マウスの右ボタンで押すと、× の入力を始めること", () => {
      press(getCell("1行2列 未確定"), { pointerType: "mouse", button: 2 });

      expect(props.onStartStroke).toHaveBeenCalledWith(1, "crossed");
    });

    test("キーボードでマスを押すと、1マスだけの入力をすること", () => {
      fireEvent.click(getCell("1行2列 未確定"), { detail: 0 });

      expect(props.onStartStroke).toHaveBeenCalledWith(1, "filled");
      expect(props.onEndStroke).toHaveBeenCalledOnce();
    });

    test("指やマウスの押下に続く click では入力しないこと", () => {
      fireEvent.click(getCell("1行2列 未確定"), { detail: 1 });

      expect(props.onStartStroke).not.toHaveBeenCalled();
    });

    test("待ったを押すと直前の入力を取り消すこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "待った" }));

      expect(props.onUndo).toHaveBeenCalledOnce();
    });

    describe("入れる印を × に切り替えた場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "バツ" }));
      });

      test("マスを押すと、× の入力を始めること", () => {
        press(getCell("1行2列 未確定"), { pointerType: "touch" });

        expect(props.onStartStroke).toHaveBeenCalledWith(1, "crossed");
      });
    });
  });

  describe("マスを押している場合", () => {
    beforeEach(() => {
      renderPlay(
        createProps({ strokeRange: { startCellIndex: 3, endCellIndex: 5 } }),
      );
    });

    test("押しているマスの行・列のヒントを強調すること", () => {
      const rowClue = screen.getByRole("note", { name: "2行目のヒント 3" });
      const otherRowClue = screen.getByRole("note", {
        name: "3行目のヒント 1",
      });

      expect(rowClue.getAttribute("aria-current")).toBe("true");
      expect(otherRowClue.getAttribute("aria-current")).toBeNull();
    });
  });

  describe("完成演出中の場合", () => {
    let props: ReturnType<typeof createProps>;

    beforeEach(() => {
      props = createProps({ progress: "clearing", canUndo: false });
      renderPlay(props);
    });

    test("マスを押せず、入力を始めないこと", () => {
      press(getCell("1行2列 未確定"), { pointerType: "touch" });

      expect(getCell("1行2列 未確定")).toHaveProperty("disabled", true);
      expect(props.onStartStroke).not.toHaveBeenCalled();
    });
  });

  describe("完成演出が終わった場合", () => {
    let props: ReturnType<typeof createProps>;

    beforeEach(() => {
      props = createProps({ progress: "result", result, canUndo: false });
      renderPlay(props);
    });

    test("ゲーム名・難易度・スコアを結果画面に表示し、盤面を表示しないこと", () => {
      const heading = screen.getByRole("heading", { name: "プレイ結果" });
      const score = within(screen.getByRole("region", { name: "スコア" }));
      const boardGroup = screen.queryByRole("group", {
        name: "ノノグラム盤面",
      });

      expect(heading).toBeTruthy();
      expect(screen.getByText("レベル 1")).toBeTruthy();
      expect(score.getByText("87")).toBeTruthy();
      expect(boardGroup).toBeNull();
    });

    test("時間と基準時間との差・塗り直しを主な成績として表示すること", () => {
      const terms = screen.getAllByRole("term").map((term) => term.textContent);
      const definitions = screen
        .getAllByRole("definition")
        .map((definition) => definition.textContent);

      expect(terms).toEqual(["時間", "塗り直し"]);
      expect(definitions).toEqual(["01:41", "基準 +00:15", "2マス"]);
    });

    const actionCases = [
      ["同じ問題", "onReplay"],
      ["記録を確認", "onOpenRecords"],
    ] as const;

    test.each(actionCases)(
      "%s ボタンで対応する操作を通知すること",
      (buttonName, callbackName) => {
        fireEvent.click(screen.getByRole("button", { name: buttonName }));

        expect(props[callbackName]).toHaveBeenCalledOnce();
      },
    );

    describe("スコアの内訳を開いた場合", () => {
      beforeEach(() => {
        fireEvent.click(
          screen.getByRole("button", { name: "スコアの内訳・採点基準" }),
        );
      });

      test("観点ごとの点数と、減点しない待ったと盤面を戻した回数、基準時間と作業の量を内訳に表示すること", () => {
        const terms = screen
          .getAllByRole("term")
          .map((term) => term.textContent);
        const definitions = screen
          .getAllByRole("definition")
          .map((definition) => definition.textContent);

        expect(terms).toEqual(
          expect.arrayContaining([
            "速さ",
            "正確さ",
            "待った",
            "盤面を戻す",
            "基準時間",
            "行・列",
            "塗るマス",
            "連鎖の段",
          ]),
        );
        expect(definitions).toEqual(
          expect.arrayContaining([
            "78 / 85",
            "9 / 15",
            "3回",
            "1回",
            "01:26",
            "16本",
            "32マス",
            "4回",
          ]),
        );
      });

      test("基準時間を問題の作業の量から求める式と0点になる時間を表示すること", () => {
        const criteria = screen.getByText(/基準時間は/);

        expect(criteria.textContent).toBe(
          "基準時間01:26以内で85点、04:18以上で0点、その間は時間に応じて減らす。基準時間は盤面把握10秒 + 行・列16本 × 2秒 + 塗るマス32マス × 0.75秒 + 連鎖の段4回 × 5秒。連鎖の段は、決まったマスを使って次の行・列を読み進める回数で、この問題を仮置きなしに解くときに要る数。最初に読む1回も含む。",
        );
      });

      test("塗り直しの減点と数え方、減点しない操作を表示すること", () => {
        const criteria = screen.getByText(/塗り直し1マスにつき/);

        expect(criteria.textContent).toBe(
          "15点から、塗り直し1マスにつき3点を減らす。塗り直しは、塗ったマスを未確定か × に変えたマスの数で、「待った」で消えた塗りも数え、「盤面を戻す」で消えた塗りは数えない。× の付け外し、「待った」と「盤面を戻す」の回数は減らさない。",
        );
      });
    });
  });
});
