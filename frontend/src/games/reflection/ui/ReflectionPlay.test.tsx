import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";

import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import {
  countReflectionBoardPieces,
  createEmptyReflectionBoard,
  parseReflectionBoard,
} from "@/games/reflection/puzzle/board";
import {
  computeReflectionClues,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import {
  readReflectionHowToPlaySeen,
  writeReflectionHowToPlaySeen,
} from "@/games/reflection/ui/how-to-play-seen";
import { ReflectionPlay } from "@/games/reflection/ui/ReflectionPlay";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("ReflectionPlay", () => {
  const solution = parseReflectionBoard(["/..", "...", "..@"]);
  const inventory = countReflectionBoardPieces(solution);
  const clues = computeReflectionClues(solution);
  const emptyBoard = createEmptyReflectionBoard(3);
  const placedBoard = parseReflectionBoard(["...", ".@.", "..."]);
  const leftMiddle = { side: "left", index: 1 } as const;

  const callbacks = {
    onTapCell: vi.fn(),
    onTapStock: vi.fn(),
    onTapClue: vi.fn(),
    onRemovePiece: vi.fn(),
    onClearSelection: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    onStartNewProblem: vi.fn(),
    onBackToHome: vi.fn(),
  };

  const baseProps: ComponentProps<typeof ReflectionPlay> = {
    difficultyLabel: "レベル 1",
    laserPathMode: "assist",
    progress: "playing",
    board: emptyBoard,
    clues,
    inventory,
    stock: inventory,
    selection: null,
    laser: null,
    relocationCount: 3,
    undoCount: 1,
    elapsedMs: 65_000,
    canUndo: true,
    canRestart: false,
    ...callbacks,
  };

  function renderPlay(props: Partial<ComponentProps<typeof ReflectionPlay>>) {
    render(<ReflectionPlay {...baseProps} {...props} />);
  }

  function getBoardGroup(): HTMLElement {
    return screen.getByRole("group", {
      name: `${REFLECTION_DISPLAY_NAME}盤面`,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    writeReflectionHowToPlaySeen();
  });

  describe("初めて遊ぶ場合", () => {
    beforeEach(() => {
      window.localStorage.clear();
      renderPlay({});
    });

    test("遊び方を開き、光路表示を補助として説明すること", () => {
      const dialog = screen.getByRole("dialog", { name: "遊び方" });

      expect(
        within(dialog).getByText(/補助。使った回数は記録に残る/),
      ).toBeTruthy();
    });

    test("遊び方を閉じると測り直し、次からは開かないこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

      expect(callbacks.onReplay).toHaveBeenCalledOnce();
      expect(readReflectionHowToPlaySeen()).toBe(true);
    });
  });

  describe("光路表示を通常の操作として扱う場合", () => {
    beforeEach(() => {
      window.localStorage.clear();
      renderPlay({ laserPathMode: "normal" });
    });

    test("遊び方で補助と説明しないこと", () => {
      const dialog = screen.getByRole("dialog", { name: "遊び方" });

      expect(within(dialog).queryByText(/補助/)).toBeNull();
    });
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderPlay({});
    });

    test("置き直し・時間・待ったをヘッダーに出すこと", () => {
      const header = screen
        .getByRole("heading", { name: REFLECTION_DISPLAY_NAME })
        .closest("header") as HTMLElement;

      expect(within(header).getByText("置き直し")).toBeTruthy();
      expect(within(header).getByText("01:05")).toBeTruthy();
      expect(within(header).getByText("待った")).toBeTruthy();
    });

    test("外周ヒントを押すとその位置を知らせること", () => {
      fireEvent.click(screen.getByRole("button", { name: "左2行 退出 3マス" }));

      expect(callbacks.onTapClue).toHaveBeenCalledWith(leftMiddle);
    });

    test("数字キーでストックの種類を並び順に選ぶこと", () => {
      const firstCell = within(getBoardGroup()).getAllByRole("button")[0];

      fireEvent.keyDown(firstCell as HTMLElement, { key: "2" });

      expect(callbacks.onTapStock).toHaveBeenCalledWith("black-hole");
    });

    test("Escape で選択の解除を求めること", () => {
      const firstCell = within(getBoardGroup()).getAllByRole("button")[0];

      fireEvent.keyDown(firstCell as HTMLElement, { key: "Escape" });

      expect(callbacks.onClearSelection).toHaveBeenCalledOnce();
    });
  });

  describe("盤面のピースを選んでいる場合", () => {
    beforeEach(() => {
      renderPlay({
        board: placedBoard,
        stock: { ...inventory, "black-hole": 0 },
        selection: { type: "cell", cellIndex: 4 },
      });
    });

    test("ストックを戻し先として示し、残りが無い種類も押せること", () => {
      const stock = screen.getByRole("group", {
        name: "ストック（押すとストックへ戻す）",
      });
      const blackHole = within(stock).getByRole("button", {
        name: "ブラックホール 残り0",
      });

      expect(screen.getByText("ここへ戻す")).toBeTruthy();
      expect(blackHole.hasAttribute("disabled")).toBe(false);
    });

    test("Delete でフォーカス中のマスのピースを戻すこと", () => {
      const cell = within(getBoardGroup()).getByRole("button", {
        name: "2行2列 ブラックホール",
      });
      fireEvent.focus(cell);

      fireEvent.keyDown(cell, { key: "Delete" });

      expect(callbacks.onRemovePiece).toHaveBeenCalledWith(4);
    });
  });

  describe("光路を表示している場合", () => {
    beforeEach(() => {
      renderPlay({
        board: placedBoard,
        laser: {
          entry: leftMiddle,
          trace: traceReflectionLaser(placedBoard, leftMiddle),
        },
      });
    });

    test("今の盤面での結果と通ったマスの数を出すこと", () => {
      const status = screen.getByText("左2行の光").parentElement;

      expect(status?.textContent).toContain("吸収");
      expect(status?.textContent).toContain("2マス");
    });

    test("表示中の外周ヒントを押されている状態にすること", () => {
      const clue = screen.getByRole("button", { name: "左2行 退出 3マス" });

      expect(clue.getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("完成演出を終えた場合", () => {
    beforeEach(() => {
      renderPlay({ board: solution, progress: "result", canUndo: false });
    });

    test("完成を示し、次の行動を出すこと", () => {
      const status = screen.getByRole("status");

      expect(within(status).getByText("完成！")).toBeTruthy();
      expect(within(status).getByText("レベル 1")).toBeTruthy();
      expect(
        within(status).getByRole("button", { name: "別の問題" }),
      ).toBeTruthy();
    });
  });
});
