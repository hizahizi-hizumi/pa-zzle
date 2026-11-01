import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";

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
});
