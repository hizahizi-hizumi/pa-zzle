import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";

import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import { createHitofudePuzzleResult } from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import { parseHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";
import type { HitofudePuzzleSessionResult } from "@/games/hitofude-puzzle/session/session";
import { HitofudePuzzlePlay } from "@/games/hitofude-puzzle/ui/HitofudePuzzlePlay";

afterEach(() => {
  cleanup();
});

// 基準時間 5 + 64 × 0.5 + 10 × 3 + 4 × 3 + min(130, 45) × 1 = 124秒（02:04）、0点になる時間 06:12。
const workload = {
  openCellCount: 64,
  fatalBranchCount: 10,
  assumptionCount: 4,
  refutationStepCount: 130,
  longestRefutationLength: 20,
};

// 21秒超過で速さ55点、引き直し2回で正確さ34点。待った・盤面を戻すの回数は点に入らない。
const performance: HitofudePuzzleSessionResult = {
  elapsedMs: 145_000,
  backtrackCount: 2,
  retractedCellCount: 9,
  undoCount: 3,
  restartCount: 1,
  inputCount: 40,
};
const result = createHitofudePuzzleResult(performance, workload);
const perfectResult = createHitofudePuzzleResult(
  { ...performance, elapsedMs: 115_000, backtrackCount: 0 },
  workload,
);

describe("HitofudePuzzlePlay", () => {
  const board = parseHitofudePuzzleBoard(["S . .", ". . .", ". . ."]);
  const callbacks = {
    onBeginStroke: vi.fn(),
    onTraceStroke: vi.fn(),
    onEndStroke: vi.fn(),
    onMoveHeadToward: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenRecords: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
  };
  const baseProps: ComponentProps<typeof HitofudePuzzlePlay> = {
    difficulty: "4",
    progress: "result",
    elapsedMs: performance.elapsedMs,
    result,
    recordOutcomeNotice: null,
    board,
    path: [0, 1, 2, 5, 4, 3, 6, 7, 8],
    isDeadEnd: false,
    strandedCells: [],
    blockedMove: null,
    canUndo: false,
    canRestart: false,
    ...callbacks,
  };

  function renderResult(
    props: Partial<ComponentProps<typeof HitofudePuzzlePlay>> = {},
  ) {
    return render(<HitofudePuzzlePlay {...baseProps} {...props} />);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("完成演出中の場合", () => {
    beforeEach(() => {
      renderResult({ progress: "clearing" });
    });

    test("盤面を見せ、結果画面をまだ出さないこと", () => {
      const boardGroup = screen.getByRole("group", {
        name: `${HITOFUDE_PUZZLE_DISPLAY_NAME}盤面`,
      });
      const resultScreen = screen.queryByRole("region", { name: "プレイ結果" });

      expect(boardGroup).toBeTruthy();
      expect(resultScreen).toBeNull();
    });
  });

  describe("完成演出を終えた場合", () => {
    beforeEach(() => {
      renderResult();
    });

    test("共通の結果階層でピクトグラム・ゲーム名・難易度・スコアを表示すること", () => {
      const pictogram = document.querySelector(
        `svg[aria-label="${HITOFUDE_PUZZLE_DISPLAY_NAME}"]`,
      );
      const score = within(screen.getByRole("region", { name: "スコア" }));

      expect(pictogram).toBeTruthy();
      expect(screen.getByText(HITOFUDE_PUZZLE_DISPLAY_NAME)).toBeTruthy();
      expect(screen.getByText("レベル 4")).toBeTruthy();
      expect(score.getByText("89")).toBeTruthy();
    });

    test("時間と基準時間との差・引き直しを主な成績として表示すること", () => {
      const terms = screen.getAllByRole("term").map((term) => term.textContent);
      const definitions = screen
        .getAllByRole("definition")
        .map((definition) => definition.textContent);

      expect(terms).toEqual(["時間", "引き直し"]);
      expect(definitions).toEqual(["02:25", "基準 +00:21", "2回"]);
    });

    test("盤面を表示しないこと", () => {
      const boardGroup = screen.queryByRole("group", {
        name: `${HITOFUDE_PUZZLE_DISPLAY_NAME}盤面`,
      });

      expect(boardGroup).toBeNull();
    });

    const actionCases = [
      ["プレイ！", "onStartNewProblem"],
      ["同じ問題", "onReplay"],
      ["記録を確認", "onOpenRecords"],
      ["難易度変更", "onChangeDifficulty"],
      ["ホーム", "onBackToHome"],
    ] as const;

    test.each(actionCases)(
      "%s ボタンで対応する操作を通知すること",
      (buttonName, callbackName) => {
        fireEvent.click(screen.getByRole("button", { name: buttonName }));

        expect(callbacks[callbackName]).toHaveBeenCalledOnce();
      },
    );

    describe("スコアの内訳を開いた場合", () => {
      beforeEach(() => {
        fireEvent.click(
          screen.getByRole("button", { name: "スコアの内訳・採点基準" }),
        );
      });

      test("速さ・正確さの点を速さから並べ、操作の回数・基準時間を内訳に表示し、問題の作業の量は内訳に並べないこと", () => {
        const items = screen
          .getAllByRole("term")
          .map(
            (term) => `${term.textContent} ${term.nextSibling?.textContent}`,
          );

        expect(items).toEqual(
          expect.arrayContaining([
            "速さ 55 / 60",
            "正確さ 34 / 40",
            "待った 3回",
            "盤面を戻す 1回",
            "基準時間 02:04",
          ]),
        );
        expect(
          items.filter((item) =>
            /^(通るマス|分かれ道|数手先を読む|読む手数) /.test(item),
          ),
        ).toEqual([]);
        expect(items.findIndex((item) => item.startsWith("速さ"))).toBeLessThan(
          items.findIndex((item) => item.startsWith("正確さ")),
        );
      });

      test("速さの基準を、この問題の作業の量から求める式と0点になる時間で表示すること", () => {
        const criteria = screen.getByText(/^基準時間02:04以内/);

        expect(criteria.textContent).toBe(
          "基準時間02:04以内で60点、06:12以上で0点、その間は時間に応じて減らす。基準時間は盤面把握5秒 + 通るマス64マス × 0.5秒 + 分かれ道10か所 × 3秒 + 数手先を読む4回 × 3秒 + 読む手数45手 × 1秒。式の数はこの問題で決まり、プレイでは変わらない。分かれ道は、進む向きを誤ると全マスを通れなくなる所。数手先を読む回数と読む手数は、この問題を盤面から読んで解くのに要る量（読む手数は45手まで数える）。",
        );
      });

      test("正確さの基準を、引き直しの減点と数え方で表示すること", () => {
        const criteria = screen.getByText(/^40点から/);

        expect(criteria.textContent).toBe(
          "40点から、引き直し1回につき3点を減らす。引き直しは、道を戻して前と違うマスへ引いた回数。戻して同じマスへ引いたときは数えない。「待った」・「盤面を戻す」で戻したときも同じに数え、「待った」で前の道筋へ戻したときも1回と数える。",
        );
      });
    });
  });

  /** 盤面を一辺 300px の正方形として置いたときの、マスの中心の座標。 */
  function getCellCenter(cell: number) {
    const cellWidth = 300 / board.size;
    return {
      clientX: ((cell % board.size) + 0.5) * cellWidth,
      clientY: (Math.floor(cell / board.size) + 0.5) * cellWidth,
    };
  }

  function getBoardGroup(): HTMLElement {
    return screen.getByRole("group", {
      name: `${HITOFUDE_PUZZLE_DISPLAY_NAME}盤面`,
    });
  }

  describe("プレイ中の場合", () => {
    const touch = { pointerId: 1, pointerType: "touch", isPrimary: true };

    beforeEach(() => {
      renderResult({ progress: "playing", result: null, path: [0, 1] });
      vi.spyOn(getBoardGroup(), "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 300, 300),
      );
    });

    const arrowKeyCases = [
      ["ArrowUp", "up"],
      ["ArrowRight", "right"],
      ["ArrowDown", "down"],
      ["ArrowLeft", "left"],
    ] as const;

    test.each(arrowKeyCases)(
      "%s キーでその向きへ先端を動かす操作を通知すること",
      (key, direction) => {
        fireEvent.keyDown(document.body, { key });

        expect(callbacks.onMoveHeadToward).toHaveBeenCalledWith(direction);
      },
    );

    test("盤面のマスにフォーカスがあっても矢印キーを盤面へ流すこと", () => {
      const [cell] = within(getBoardGroup()).getAllByRole("button");
      fireEvent.keyDown(cell!, { key: "ArrowRight" });

      expect(callbacks.onMoveHeadToward).toHaveBeenCalledWith("right");
    });

    const modifierCases = [
      ["altKey"],
      ["ctrlKey"],
      ["metaKey"],
      ["shiftKey"],
    ] as const;

    test.each(modifierCases)(
      "%s 付きの矢印キーは盤面へ流さないこと",
      (modifier) => {
        fireEvent.keyDown(document.body, {
          key: "ArrowRight",
          [modifier]: true,
        });

        expect(callbacks.onMoveHeadToward).not.toHaveBeenCalled();
      },
    );

    test("ほかの部品が先に扱った矢印キーは盤面へ流さないこと", () => {
      const event = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      });
      event.preventDefault();
      document.body.dispatchEvent(event);

      expect(callbacks.onMoveHeadToward).not.toHaveBeenCalled();
    });

    describe("プレイ画面の外の要素で矢印キーを押した場合", () => {
      let outside: HTMLButtonElement;

      beforeEach(() => {
        outside = document.createElement("button");
        document.body.append(outside);
      });

      afterEach(() => {
        outside.remove();
      });

      test("盤面へ流さないこと", () => {
        fireEvent.keyDown(outside, { key: "ArrowRight" });

        expect(callbacks.onMoveHeadToward).not.toHaveBeenCalled();
      });
    });

    test("指で押してなぞり、離すまでを1回のなぞりとして通知すること", () => {
      fireEvent.pointerDown(getBoardGroup(), { ...touch, ...getCellCenter(1) });
      fireEvent.pointerMove(getBoardGroup(), { ...touch, ...getCellCenter(2) });
      fireEvent.pointerUp(getBoardGroup(), touch);

      expect(callbacks.onBeginStroke).toHaveBeenCalledWith(1);
      expect(callbacks.onTraceStroke).toHaveBeenCalledWith({
        from: 1,
        to: 2,
        horizontalFirst: true,
      });
      expect(callbacks.onEndStroke).toHaveBeenCalledOnce();
    });

    test("2本目以降の指は受けないこと", () => {
      fireEvent.pointerDown(getBoardGroup(), {
        ...touch,
        isPrimary: false,
        ...getCellCenter(1),
      });

      expect(callbacks.onBeginStroke).not.toHaveBeenCalled();
    });

    const interruptionCases = [
      ["pointercancel", fireEvent.pointerCancel],
      ["lostpointercapture", fireEvent.lostPointerCapture],
    ] as const;

    test.each(interruptionCases)(
      "%s でなぞりを閉じ、その後の指の動きを通知しないこと",
      (_, interrupt) => {
        fireEvent.pointerDown(getBoardGroup(), {
          ...touch,
          ...getCellCenter(1),
        });
        interrupt(getBoardGroup(), touch);
        fireEvent.pointerMove(getBoardGroup(), {
          ...touch,
          ...getCellCenter(2),
        });

        expect(callbacks.onEndStroke).toHaveBeenCalledOnce();
        expect(callbacks.onTraceStroke).not.toHaveBeenCalled();
      },
    );

    test("指やマウスから届くマスの click では、マスを押す操作を通知しないこと", () => {
      const [cell] = within(getBoardGroup()).getAllByRole("button");
      fireEvent.click(cell!, { detail: 1 });

      expect(callbacks.onBeginStroke).not.toHaveBeenCalled();
    });

    test("キーボードや支援技術から押したマスは、押して離す操作として通知すること", () => {
      const [cell] = within(getBoardGroup()).getAllByRole("button");
      fireEvent.click(cell!, { detail: 0 });

      expect(callbacks.onBeginStroke).toHaveBeenCalledWith(0);
      expect(callbacks.onEndStroke).toHaveBeenCalledOnce();
    });
  });

  describe("キーボードで盤面を操作する場合", () => {
    const playingProps = {
      progress: "playing",
      result: null,
      path: [0, 1],
    } as const;
    let rerender: ReturnType<typeof render>["rerender"];

    function listFocusableCells(): number[] {
      return within(getBoardGroup())
        .getAllByRole("button")
        .flatMap((cell, index) => (cell.tabIndex === 0 ? [index] : []));
    }

    beforeEach(() => {
      ({ rerender } = renderResult(playingProps));
    });

    test("盤面の Tab の止まり先を先端のマス1つにすること", () => {
      const focusableCells = listFocusableCells();

      expect(focusableCells).toEqual([1]);
    });

    describe("先端のマスにフォーカスがある場合", () => {
      beforeEach(() => {
        within(getBoardGroup()).getAllByRole("button")[1]!.focus();
      });

      test("Shift と矢印キーで、先端を動かさずに隣のマスへフォーカスと止まり先を移すこと", () => {
        fireEvent.keyDown(document.activeElement!, {
          key: "ArrowRight",
          shiftKey: true,
        });

        const cells = within(getBoardGroup()).getAllByRole("button");
        expect(document.activeElement).toBe(cells[2]);
        expect(listFocusableCells()).toEqual([2]);
        expect(callbacks.onMoveHeadToward).not.toHaveBeenCalled();
      });

      test("先端が動くと、フォーカスと止まり先を新しい先端へ移すこと", () => {
        rerender(
          <HitofudePuzzlePlay
            {...baseProps}
            {...playingProps}
            path={[0, 1, 2]}
          />,
        );

        const cells = within(getBoardGroup()).getAllByRole("button");
        expect(document.activeElement).toBe(cells[2]);
        expect(listFocusableCells()).toEqual([2]);
      });
    });
  });

  describe("穴のある盤面の場合", () => {
    // 右上の角（2）と真ん中（4）が穴。
    const holedBoard = parseHitofudePuzzleBoard(["S . #", ". # .", ". . ."]);

    beforeEach(() => {
      renderResult({
        progress: "playing",
        result: null,
        board: holedBoard,
        path: [0],
      });
    });

    test("穴のマスの読み上げ名で穴だと知らせること", () => {
      const cells = within(getBoardGroup()).getAllByRole("button");

      expect(cells[2]?.getAttribute("aria-label")).toBe("1行3列 穴");
      expect(cells[4]?.getAttribute("aria-label")).toBe("2行2列 穴");
    });
  });

  describe("取り残しのマスを渡した場合", () => {
    beforeEach(() => {
      renderResult({
        progress: "playing",
        result: null,
        path: [0, 1],
        strandedCells: [2],
      });
    });

    test("そのマスの読み上げ名で取り残しを知らせること", () => {
      const cells = within(getBoardGroup()).getAllByRole("button");

      expect(cells[2]?.getAttribute("aria-label")).toBe("1行3列 取り残し");
    });
  });

  describe("プレイを終えて完成演出中の場合", () => {
    beforeEach(() => {
      renderResult({ progress: "clearing" });
      vi.spyOn(getBoardGroup(), "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 300, 300),
      );
    });

    test("矢印キーを盤面へ流さないこと", () => {
      fireEvent.keyDown(document.body, { key: "ArrowRight" });

      expect(callbacks.onMoveHeadToward).not.toHaveBeenCalled();
    });

    test("盤面のなぞりを受けないこと", () => {
      fireEvent.pointerDown(getBoardGroup(), {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        ...getCellCenter(1),
      });

      expect(callbacks.onBeginStroke).not.toHaveBeenCalled();
    });
  });

  describe("100点で解いた場合", () => {
    beforeEach(() => {
      renderResult({ result: perfectResult });
    });

    test("最高段階として称え、基準時間より速かった差を負の時間で表示すること", () => {
      expect(screen.getByText("パーフェクト！")).toBeTruthy();
      expect(screen.getByText("基準 -00:09")).toBeTruthy();
    });
  });

  describe("検証情報のつなぎ先を渡した場合", () => {
    const onOpenDiagnostics = vi.fn();

    beforeEach(() => {
      renderResult({ onOpenDiagnostics });
    });

    test("検証情報ボタンで検証情報を開く操作を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "検証情報" }));

      expect(onOpenDiagnostics).toHaveBeenCalledOnce();
    });
  });
});
